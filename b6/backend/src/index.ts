
// import express from "express";
import express, { Request, Response } from "express";
import session from "express-session";
import { DataSource } from "typeorm";
import "reflect-metadata";
import { User } from "./repo/User";
import { Thread } from "./repo/Thread";
import { ThreadItem } from "./repo/ThreadItem";
import { ThreadPoint } from "./repo/ThreadPoint";
import { ThreadItemPoint } from "./repo/ThreadItemPoint";
import { ThreadCategory } from "./repo/ThreadCategory";
import { Auditable } from "./repo/Auditable";
import { ApolloServer } from "apollo-server-express";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "./gql/typeDefs";
import resolvers from "./gql/resolvers";
import cors from "cors";
import path from 'path';
import fs from 'fs';
import http from 'http';
import syncRoutes from './routes/sync.js';
import { runSeeder } from "./scripts/seed-database";


console.log("Starting Server B6...");
console.log("Environment:", process.env.NODE_ENV);

const app = express() as any;

// === COOKIE FIX MIDDLEWARE ===
const originalSetHeader = http.ServerResponse.prototype.setHeader;
http.ServerResponse.prototype.setHeader = function(name: string, value: any) {
  if (name.toLowerCase() === 'set-cookie') {
    console.log('🔧 COOKIE FIX: Intercepting Set-Cookie header');
    
    const fixCookie = (cookie: string): string => {
      let fixedCookie = cookie;
      
      if (!fixedCookie.includes('Secure')) {
        if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true') {
          fixedCookie += '; Secure';
          console.log('   ✅ Added Secure flag');
        }
      }
      
      if (!fixedCookie.includes('SameSite')) {
        fixedCookie += '; SameSite=None';
        console.log('   ✅ Added SameSite=None');
      }
      
      if (fixedCookie.includes('connect.sid') && (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true')) {
        if (!fixedCookie.includes('Domain=')) {
          fixedCookie += '; Domain=192.168.0.151';
          console.log('   ✅ Added Domain=192.168.0.151');
        }
      }
      
      return fixedCookie;
    };
    
    if (Array.isArray(value)) {
      value = value.map((cookie: string) => fixCookie(cookie));
    } else if (typeof value === 'string') {
      value = fixCookie(value);
    }
  }
  
  return originalSetHeader.call(this, name, value);
};

// CORS Configuration
app.use(cors({
    credentials: true,
    origin: true,
}));

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5016;

// FIX: Parse JSON for all routes EXCEPT /graphql (Apollo needs the raw stream)
app.use((req: any, res: any, next: any) => {
  if (req.path === '/graphql' || req.path === '/graphql/') {
    return next();
  }
  return express.json()(req, res, next);
});

// Register sync routes (Now they will have access to req.body)
app.use('/', syncRoutes);

// Health endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        server: 'AquaWisdom B6 Server',
        version: 'B6-1.0.0'
    });
});

const router = express.Router();

declare module 'express-session' {
    interface SessionData {
        userId: any;
        loadedCount: number;
    }
}

// == DATABASE CONFIGURATION ==
const isDocker = process.env.DOCKER_ENV === 'true';
let dbDir: string;
let dbPath: string;

if (isDocker) {
    dbDir = '/data';
    dbPath = path.join(dbDir, 'aquawisdom_b6.db');
    console.log('Running in DOCKER environment (B6)');
} else {
    dbDir = '/home/sidneylok/UT2025_Joint_SQL_CAP_S1_B6';
    dbPath = path.join(dbDir, 'aquawisdom_b6.db');
    console.log('Running in DEVELOPMENT environment (B6)');
}

if (!fs.existsSync(dbDir)) {
    console.log(`Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`B6 Database path: ${dbPath}`);

// TypeORM Data Source
export const AppDataSource_Joint_UT_SQL_CAP_S1_B6 = new DataSource({
    type: "sqlite",
    database: dbPath,
    entities: [ User, Thread, ThreadItem, ThreadPoint, ThreadItemPoint, ThreadCategory, Auditable ],
    synchronize: true,
    logging: process.env.NODE_ENV !== 'production',
});

// Initialize Database
AppDataSource_Joint_UT_SQL_CAP_S1_B6
    .initialize()
    .then(async () => {
        console.log(`B6 Database initialized at: ${dbPath}`);

        
        // ADD THIS LINE RIGHT HERE:
        await runSeeder(AppDataSource_Joint_UT_SQL_CAP_S1_B6);

        app.listen(PORT, () => {
          console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('B6 Database initialization error:', error);
        process.exit(1);
    });

// === DYNAMIC IMPORT FOR MEMORYSTORE ===
let sessionStore: any;

async function setupMemoryStore() {
  try {
    // Dynamic import for memorystore (works with ES modules)
    const memorystoreModule = await import('memorystore');
    const memorystore = memorystoreModule.default || memorystoreModule;
    
    const MemoryStore = (memorystore as any)(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000,
      max: 100,
    });
    
    console.log('✅ MemoryStore loaded successfully');
    
    // Now setup the session middleware
    // Note: bodyParser.json() was previously here, moved to the top of the file.
    app.use(
      session({
        store: sessionStore,
        sameSite: "none",
        secret: process.env.SESSION_SECRET || 'change-this-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
          path: "/",
          httpOnly: true,
          secure: false,
          maxAge: 1000 * 60 * 60 * 24,
        },
      } as any)
    );
    
    app.use(router);
    
    // Start the server
    await startServer();
    
  } catch (error) {
    console.error('❌ Failed to load memorystore:', error);
    console.error('Memorystore might not be installed or has ES module issues.');
    console.error('Try: npm install memorystore');
    process.exit(1);
  }
}

// Apollo Server
const schema = makeExecutableSchema({ typeDefs, resolvers });
const apolloServer = new ApolloServer({
  schema,
  context: ({ req, res }: any) => ({ req, res }),
  introspection: process.env.NODE_ENV !== 'production'
});

async function startServer() {
  try {
    await apolloServer.start();
    apolloServer.applyMiddleware({ app, cors: false });

    app.listen({ port: PORT, host: HOST }, () => {
      console.log(`
✅ SERVER STARTED SUCCESSFULLY (B6)
===========================
☞ Server URL: http://${HOST}:${PORT}
☒ GraphQL: http://${HOST}:${PORT}${apolloServer.graphqlPath}
📖 Database: ${dbPath}
💾 Sessions: MemoryStore (dynamic import)
🌍 Environment: ${isDocker ? 'DOCKER' : 'DEVELOPMENT'}
📝 Port: ${PORT}
===========================
      `);
    });
  } catch (error) {
    console.error('✗ Failed to start B6 server:', error);
    process.exit(1);
  }
}

// Start the setup process
setupMemoryStore().catch(console.error);

// // import express from "express";
// import express, { Request, Response } from "express";
// import session from "express-session";
// import { DataSource } from "typeorm";
// import "reflect-metadata";
// import { User } from "./repo/User";
// import { Thread } from "./repo/Thread";
// import { ThreadItem } from "./repo/ThreadItem";
// import { ThreadPoint } from "./repo/ThreadPoint";
// import { ThreadItemPoint } from "./repo/ThreadItemPoint";
// import { ThreadCategory } from "./repo/ThreadCategory";
// import { Auditable } from "./repo/Auditable";
// import { ApolloServer } from "apollo-server-express";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import typeDefs from "./gql/typeDefs";
// import resolvers from "./gql/resolvers";
// import cors from "cors";
// import path from 'path';
// import fs from 'fs';
// import http from 'http';
// import syncRoutes from './routes/sync.js';


// console.log("Starting Server B6...");
// console.log("Environment:", process.env.NODE_ENV);

// const app = express() as any;

// // FIX: Add JSON body parser FIRST so REST routes (like /api/sync) can read req.body
// // app.use(express.json());

// // === COOKIE FIX MIDDLEWARE ===
// const originalSetHeader = http.ServerResponse.prototype.setHeader;
// http.ServerResponse.prototype.setHeader = function(name: string, value: any) {
//   if (name.toLowerCase() === 'set-cookie') {
//     console.log('🔧 COOKIE FIX: Intercepting Set-Cookie header');
    
//     const fixCookie = (cookie: string): string => {
//       let fixedCookie = cookie;
      
//       if (!fixedCookie.includes('Secure')) {
//         if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true') {
//           fixedCookie += '; Secure';
//           console.log('   ✅ Added Secure flag');
//         }
//       }
      
//       if (!fixedCookie.includes('SameSite')) {
//         fixedCookie += '; SameSite=None';
//         console.log('   ✅ Added SameSite=None');
//       }
      
//       if (fixedCookie.includes('connect.sid') && (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true')) {
//         if (!fixedCookie.includes('Domain=')) {
//           fixedCookie += '; Domain=192.168.0.151';
//           console.log('   ✅ Added Domain=192.168.0.151');
//         }
//       }
      
//       return fixedCookie;
//     };
    
//     if (Array.isArray(value)) {
//       value = value.map((cookie: string) => fixCookie(cookie));
//     } else if (typeof value === 'string') {
//       value = fixCookie(value);
//     }
//   }
  
//   return originalSetHeader.call(this, name, value);
// };

// // CORS Configuration
// app.use(cors({
//     credentials: true,
//     origin: true,
// }));

// const HOST = process.env.HOST || '0.0.0.0';
// const PORT = process.env.PORT || 5016;

// // Register sync routes (Now they will have access to req.body)
// app.use('/', syncRoutes);

// // Health endpoint
// app.get('/health', (req: Request, res: Response) => {
//     res.json({
//         status: 'healthy',
//         environment: process.env.NODE_ENV || 'development',
//         timestamp: new Date().toISOString(),
//         server: 'AquaWisdom B6 Server',
//         version: 'B6-1.0.0'
//     });
// });

// const router = express.Router();

// declare module 'express-session' {
//     interface SessionData {
//         userId: any;
//         loadedCount: number;
//     }
// }

// // == DATABASE CONFIGURATION ==
// const isDocker = process.env.DOCKER_ENV === 'true';
// let dbDir: string;
// let dbPath: string;

// if (isDocker) {
//     dbDir = '/data';
//     dbPath = path.join(dbDir, 'aquawisdom_b6.db');
//     console.log('Running in DOCKER environment (B6)');
// } else {
//     dbDir = '/home/sidneylok/UT2025_Joint_SQL_CAP_S1_B6';
//     dbPath = path.join(dbDir, 'aquawisdom_b6.db');
//     console.log('Running in DEVELOPMENT environment (B6)');
// }

// if (!fs.existsSync(dbDir)) {
//     console.log(`Creating database directory: ${dbDir}`);
//     fs.mkdirSync(dbDir, { recursive: true });
// }

// console.log(`B6 Database path: ${dbPath}`);

// // TypeORM Data Source
// export const AppDataSource_Joint_UT_SQL_CAP_S1_B6 = new DataSource({
//     type: "sqlite",
//     database: dbPath,
//     entities: [ User, Thread, ThreadItem, ThreadPoint, ThreadItemPoint, ThreadCategory, Auditable ],
//     synchronize: true,
//     logging: process.env.NODE_ENV !== 'production',
// });

// // Initialize Database
// AppDataSource_Joint_UT_SQL_CAP_S1_B6
//     .initialize()
//     .then(() => {
//         console.log(`B6 Database initialized at: ${dbPath}`);
//     })
//     .catch((error) => {
//         console.error('B6 Database initialization error:', error);
//         process.exit(1);
//     });

// // === DYNAMIC IMPORT FOR MEMORYSTORE ===
// let sessionStore: any;

// async function setupMemoryStore() {
//   try {
//     // Dynamic import for memorystore (works with ES modules)
//     const memorystoreModule = await import('memorystore');
//     const memorystore = memorystoreModule.default || memorystoreModule;
    
//     const MemoryStore = (memorystore as any)(session);
//     sessionStore = new MemoryStore({
//       checkPeriod: 86400000,
//       max: 100,
//     });
    
//     console.log('✅ MemoryStore loaded successfully');
    
//     // Now setup the session middleware
//     // Note: bodyParser.json() was previously here, moved to the top of the file.
//     app.use(
//       session({
//         store: sessionStore,
//         sameSite: "none",
//         secret: process.env.SESSION_SECRET || 'change-this-in-production',
//         resave: false,
//         saveUninitialized: false,
//         cookie: {
//           path: "/",
//           httpOnly: true,
//           secure: false,
//           maxAge: 1000 * 60 * 60 * 24,
//         },
//       } as any)
//     );
    
//     app.use(router);
    
//     // Start the server
//     await startServer();
    
//   } catch (error) {
//     console.error('❌ Failed to load memorystore:', error);
//     console.error('Memorystore might not be installed or has ES module issues.');
//     console.error('Try: npm install memorystore');
//     process.exit(1);
//   }
// }

// // Apollo Server
// const schema = makeExecutableSchema({ typeDefs, resolvers });
// const apolloServer = new ApolloServer({
//   schema,
//   context: ({ req, res }: any) => ({ req, res }),
//   introspection: process.env.NODE_ENV !== 'production'
// });

// async function startServer() {
//   try {
//     await apolloServer.start();
//     apolloServer.applyMiddleware({ app, cors: false });

//     app.listen({ port: PORT, host: HOST }, () => {
//       console.log(`
// ✅ SERVER STARTED SUCCESSFULLY (B6)
// ===========================
// ☞ Server URL: http://${HOST}:${PORT}
// ☒ GraphQL: http://${HOST}:${PORT}${apolloServer.graphqlPath}
// 📖 Database: ${dbPath}
// 💾 Sessions: MemoryStore (dynamic import)
// 🌍 Environment: ${isDocker ? 'DOCKER' : 'DEVELOPMENT'}
// 📝 Port: ${PORT}
// ===========================
//       `);
//     });
//   } catch (error) {
//     console.error('✗ Failed to start B6 server:', error);
//     process.exit(1);
//   }
// }

// // Start the setup process
// setupMemoryStore().catch(console.error);

// // import express from "express";
// import express, { Request, Response } from "express";
// import session from "express-session";
// import { DataSource } from "typeorm";
// import "reflect-metadata";
// import { User } from "./repo/User";
// import { Thread } from "./repo/Thread";
// import { ThreadItem } from "./repo/ThreadItem";
// import { ThreadPoint } from "./repo/ThreadPoint";
// import { ThreadItemPoint } from "./repo/ThreadItemPoint";
// import { ThreadCategory } from "./repo/ThreadCategory";
// import { Auditable } from "./repo/Auditable";
// import { ApolloServer } from "apollo-server-express";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import typeDefs from "./gql/typeDefs";
// import resolvers from "./gql/resolvers";
// import cors from "cors";
// import path from 'path';
// import fs from 'fs';
// import http from 'http';
// import syncRoutes from './routes/sync.js';


// console.log("Starting Server B6...");
// console.log("Environment:", process.env.NODE_ENV);

// const app = express() as any;

// // === COOKIE FIX MIDDLEWARE ===
// const originalSetHeader = http.ServerResponse.prototype.setHeader;
// http.ServerResponse.prototype.setHeader = function(name: string, value: any) {
//   if (name.toLowerCase() === 'set-cookie') {
//     console.log('🔧 COOKIE FIX: Intercepting Set-Cookie header');
    
//     const fixCookie = (cookie: string): string => {
//       let fixedCookie = cookie;
      
//       if (!fixedCookie.includes('Secure')) {
//         if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true') {
//           fixedCookie += '; Secure';
//           console.log('   ✅ Added Secure flag');
//         }
//       }
      
//       if (!fixedCookie.includes('SameSite')) {
//         fixedCookie += '; SameSite=None';
//         console.log('   ✅ Added SameSite=None');
//       }
      
//       if (fixedCookie.includes('connect.sid') && (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true')) {
//         if (!fixedCookie.includes('Domain=')) {
//           fixedCookie += '; Domain=192.168.0.151';
//           console.log('   ✅ Added Domain=192.168.0.151');
//         }
//       }
      
//       return fixedCookie;
//     };
    
//     if (Array.isArray(value)) {
//       value = value.map((cookie: string) => fixCookie(cookie));
//     } else if (typeof value === 'string') {
//       value = fixCookie(value);
//     }
//   }
  
//   return originalSetHeader.call(this, name, value);
// };

// // CORS Configuration
// app.use(cors({
//     credentials: true,
//     origin: true,
// }));

// const HOST = process.env.HOST || '0.0.0.0';
// const PORT = process.env.PORT || 5016;

// app.use('/', syncRoutes);

// // Health endpoint
// app.get('/health', (req: Request, res: Response) => {
//     res.json({
//         status: 'healthy',
//         environment: process.env.NODE_ENV || 'development',
//         timestamp: new Date().toISOString(),
//         server: 'AquaWisdom B6 Server',
//         version: 'B6-1.0.0'
//     });
// });

// const router = express.Router();

// declare module 'express-session' {
//     interface SessionData {
//         userId: any;
//         loadedCount: number;
//     }
// }

// // == DATABASE CONFIGURATION ==
// const isDocker = process.env.DOCKER_ENV === 'true';
// let dbDir: string;
// let dbPath: string;

// if (isDocker) {
//     dbDir = '/data';
//     dbPath = path.join(dbDir, 'aquawisdom_b6.db');
//     console.log('Running in DOCKER environment (B6)');
// } else {
//     dbDir = '/home/sidneylok/UT2025_Joint_SQL_CAP_S1_B6';
//     dbPath = path.join(dbDir, 'aquawisdom_b6.db');
//     console.log('Running in DEVELOPMENT environment (B6)');
// }

// if (!fs.existsSync(dbDir)) {
//     console.log(`Creating database directory: ${dbDir}`);
//     fs.mkdirSync(dbDir, { recursive: true });
// }

// console.log(`B6 Database path: ${dbPath}`);

// // TypeORM Data Source
// export const AppDataSource_Joint_UT_SQL_CAP_S1_B6 = new DataSource({
//     type: "sqlite",
//     database: dbPath,
//     entities: [ User, Thread, ThreadItem, ThreadPoint, ThreadItemPoint, ThreadCategory, Auditable ],
//     synchronize: true,
//     logging: process.env.NODE_ENV !== 'production',
// });

// // Initialize Database
// AppDataSource_Joint_UT_SQL_CAP_S1_B6
//     .initialize()
//     .then(() => {
//         console.log(`B6 Database initialized at: ${dbPath}`);
//     })
//     .catch((error) => {
//         console.error('B6 Database initialization error:', error);
//         process.exit(1);
//     });

// // === DYNAMIC IMPORT FOR MEMORYSTORE ===
// let sessionStore: any;

// async function setupMemoryStore() {
//   try {
//     // Dynamic import for memorystore (works with ES modules)
//     const memorystoreModule = await import('memorystore');
//     const memorystore = memorystoreModule.default || memorystoreModule;
    
//     const MemoryStore = (memorystore as any)(session);
//     sessionStore = new MemoryStore({
//       checkPeriod: 86400000,
//       max: 100,
//     });
    
//     console.log('✅ MemoryStore loaded successfully');
    
//     // Now setup the session middleware
//     app.use(bodyParser.json());
//     app.use(
//       session({
//         store: sessionStore,
//         sameSite: "none",
//         secret: process.env.SESSION_SECRET || 'change-this-in-production',
//         resave: false,
//         saveUninitialized: false,
//         cookie: {
//           path: "/",
//           httpOnly: true,
//           secure: false,
//           maxAge: 1000 * 60 * 60 * 24,
//         },
//       } as any)
//     );
    
//     app.use(router);
    
//     // Start the server
//     await startServer();
    
//   } catch (error) {
//     console.error('❌ Failed to load memorystore:', error);
//     console.error('Memorystore might not be installed or has ES module issues.');
//     console.error('Try: npm install memorystore');
//     process.exit(1);
//   }
// }

// // Apollo Server
// const schema = makeExecutableSchema({ typeDefs, resolvers });
// const apolloServer = new ApolloServer({
//   schema,
//   context: ({ req, res }: any) => ({ req, res }),
//   introspection: process.env.NODE_ENV !== 'production'
// });

// async function startServer() {
//   try {
//     await apolloServer.start();
//     apolloServer.applyMiddleware({ app, cors: false });

//     app.listen({ port: PORT, host: HOST }, () => {
//       console.log(`
// ✅ SERVER STARTED SUCCESSFULLY (B6)
// ===========================
// ☞ Server URL: http://${HOST}:${PORT}
// ☒ GraphQL: http://${HOST}:${PORT}${apolloServer.graphqlPath}
// 📖 Database: ${dbPath}
// 💾 Sessions: MemoryStore (dynamic import)
// 🌍 Environment: ${isDocker ? 'DOCKER' : 'DEVELOPMENT'}
// 📝 Port: ${PORT}
// ===========================
//       `);
//     });
//   } catch (error) {
//     console.error('✗ Failed to start B6 server:', error);
//     process.exit(1);
//   }
// }

// // Start the setup process
// setupMemoryStore().catch(console.error);
