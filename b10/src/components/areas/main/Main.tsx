import React, { useEffect, useState } from "react";
import MainHeader from "./MainHeader";
import { useNavigate, useParams } from "react-router-dom";
import ThreadCard from "./ThreadCard";
import Category from "../../../models/Category";
import { gql, useLazyQuery } from "@apollo/client";
import { database } from "../../../db/Database";
import { isOnHomeWiFi } from "../../../utils/network";
import { syncManager } from "../../../sync/SyncManager";

const GetThreadsByCategoryId = gql`
  query getThreadsByCategoryId($categoryId: ID!) {
    getThreadsByCategoryId(categoryId: $categoryId) {
      ... on EntityResult {
        messages
      }
      ... on ThreadArray {
        threads {
          id
          title
          body
          views
          points
          createdOn
          user {
            userName
          }
          threadItems {
            id
          }
          category {
            id
            name
          }
        }
      }
    }
  }
`;

const GetThreadsLatest = gql`
  query getThreadsLatest {
    getThreadsLatest {
      ... on EntityResult {
        messages
      }
      ... on ThreadArray {
        threads {
          id
          title
          body
          views
          points
          createdOn
          user {
            userName
          }
          threadItems {
            id
          }
          category {
            id
            name
          }
        }
      }
    }
  }
`;

const Main = () => {
  const [
    execGetThreadsByCat,
    { data: threadsByCatData }
  ] = useLazyQuery(GetThreadsByCategoryId, { 
    fetchPolicy: 'network-only' // <-- ADD THIS
  });
  
  const [
    execGetThreadsLatest,
    { data: threadsLatestData }
  ] = useLazyQuery(GetThreadsLatest, { 
    fetchPolicy: 'network-only' // <-- ADD THIS
  });
  
  const { categoryId } = useParams();
  const [category, setCategory] = useState<Category | undefined>();
  const [threadCards, setThreadCards] = useState<Array<React.JSX.Element> | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Fire Apollo immediately (restores exact normal online behavior)
    if (categoryId && categoryId.length > 0) {
      execGetThreadsByCat({ variables: { categoryId } });
    } else {
      execGetThreadsLatest();
    }

    const loadData = async () => {
      const online = await isOnHomeWiFi();
      setIsOnline(online);

      // 2. If offline, fall back to SQLite
      if (!online) {
        try {
          const cachedThreads = await database.getThreads(categoryId);
          if (cachedThreads && cachedThreads.length > 0) {
            const cards = cachedThreads.map((th: any) => {
              const threadObj = {
                id: th.id, title: th.title, body: th.body, views: 0, points: th.points,
                createdOn: new Date(th.created_at), // <-- FIX
                lastModifiedOn: new Date(th.created_at), // <-- FIX
                // createdOn: th.created_at, lastModifiedOn: th.created_at,
                user: { userName: th.user_name }, threadItems: [],
                category: { id: th.category_id, name: th.category_name }
              };
              return <ThreadCard key={`thread-${th.id}`} thread={threadObj as any} />;
            });
            setThreadCards(cards);
            setCategory(new Category(cachedThreads[0].category_id, cachedThreads[0].category_name));
          }
        } catch (e) {
          console.error("SQLite read error", e);
        }
      } else {
        // 3. If online, trigger background batch sync for the last 7 days
        syncManager.backgroundSync();
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // When GraphQL returns data (Online), render and cache it!
  useEffect(() => {
    if (
      threadsByCatData &&
      threadsByCatData.getThreadsByCategoryId &&
      threadsByCatData.getThreadsByCategoryId.threads
    ) {
      const threads = threadsByCatData.getThreadsByCategoryId.threads;
      
      // CACHE TO SQLITE
      database.saveThreads(threads).catch(console.error);

      const cards = threads.map((th: any) => {
        return <ThreadCard key={`thread-${th.id}`} thread={th} />;
      });

      setCategory(threads[0].category);
      setThreadCards(cards);
    }
  }, [threadsByCatData]);

  // When GraphQL returns data (Online), render and cache it!
  useEffect(() => {
    if (
      threadsLatestData &&
      threadsLatestData.getThreadsLatest &&
      threadsLatestData.getThreadsLatest.threads
    ) {
      const threads = threadsLatestData.getThreadsLatest.threads;
      
      // CACHE TO SQLITE
      database.saveThreads(threads).catch(console.error);

      const cards = threads.map((th: any) => {
        return <ThreadCard key={`thread-${th.id}`} thread={th} />;
      });

      setCategory(new Category("0", "Latest"));
      setThreadCards(cards);
    }
  }, [threadsLatestData]);

  const onClickPostThread = () => {
    navigate("/thread");
  };

  return (
    <main className="content">
      {isOnline && (
        <button className="action-btn" onClick={onClickPostThread}>
          Create a New Topic
        </button>
      )}
      {!isOnline && (
        <div style={{ padding: '10px', backgroundColor: '#FFF3CD', marginBottom: '10px', borderRadius: '5px' }}>
          <span>📡 Offline Mode - Viewing cached conversations</span>
        </div>
      )}
      <MainHeader category={category} />
      <div>{threadCards}</div>
    </main>
  );
};

export default Main;

// import React, { useEffect, useState } from "react";
// import MainHeader from "./MainHeader";
// import { useNavigate, useParams } from "react-router-dom";
// import ThreadCard from "./ThreadCard";
// import Category from "../../../models/Category";
// import { gql, useLazyQuery } from "@apollo/client";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";
// import { syncManager } from "../../../sync/SyncManager"; // Add import

// const GetThreadsByCategoryId = gql`
//   query getThreadsByCategoryId($categoryId: ID!) {
//     getThreadsByCategoryId(categoryId: $categoryId) {
//       ... on EntityResult {
//         messages
//       }
//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;

// const GetThreadsLatest = gql`
//   query getThreadsLatest {
//     getThreadsLatest {
//       ... on EntityResult {
//         messages
//       }
//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;

// const Main = () => {
//   const [
//     execGetThreadsByCat,
//     { data: threadsByCatData }
//   ] = useLazyQuery(GetThreadsByCategoryId);
  
//   const [
//     execGetThreadsLatest,
//     { data: threadsLatestData }
//   ] = useLazyQuery(GetThreadsLatest);
  
//   const { categoryId } = useParams();
//   const [category, setCategory] = useState<Category | undefined>();
//   const [threadCards, setThreadCards] = useState<Array<React.JSX.Element> | null>(null);
//   const [isOnline, setIsOnline] = useState(true);
//   const navigate = useNavigate();

//     useEffect(() => {
//     // 1. Fire Apollo immediately (restores exact normal online behavior)
//     if (categoryId && categoryId.length > 0) {
//       execGetThreadsByCat({ variables: { categoryId } });
//     } else {
//       execGetThreadsLatest();
//     }

//     const loadData = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       // 2. If offline, fall back to SQLite
//       if (!online) {
//         try {
//           const cachedThreads = await database.getThreads(categoryId);
//           if (cachedThreads && cachedThreads.length > 0) {
//             const cards = cachedThreads.map((th: any) => {
//               const threadObj = {
//                 id: th.id, title: th.title, body: th.body, views: 0, points: th.points,
//                 createdOn: th.created_at, lastModifiedOn: th.created_at,
//                 user: { userName: th.user_name }, threadItems: [],
//                 category: { id: th.category_id, name: th.category_name }
//               };
//               return <ThreadCard key={`thread-${th.id}`} thread={threadObj as any} />;
//             });
//             setThreadCards(cards);
//             setCategory(new Category(cachedThreads[0].category_id, cachedThreads[0].category_name));
//           }
//         } catch (e) {
//           console.error("SQLite read error", e);
//         }
//       }
//     };
    
//     loadData();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [categoryId]);
  
//   // useEffect(() => {
//   //   const loadData = async () => {
//   //     // 1. INSTANTLY load from SQLite so screen is never blank
//   //     const cachedThreads = await database.getThreads(categoryId);
//   //     console.log("Main: Loaded from SQLite:", cachedThreads); // ADD THIS
//   //     if (cachedThreads && cachedThreads.length > 0) {
//   //       const cards = cachedThreads.map((th: any) => {
//   //         const threadObj = {
//   //           id: th.id,
//   //           title: th.title,
//   //           body: th.body,
//   //           views: 0,
//   //           points: th.points,
//   //           createdOn: th.created_at,
//   //           lastModifiedOn: th.created_at,
//   //           user: { userName: th.user_name },
//   //           threadItems: [],
//   //           category: { id: th.category_id, name: th.category_name }
//   //         };
//   //         return <ThreadCard key={`thread-${th.id}`} thread={threadObj as any} />;
//   //       });
//   //       setThreadCards(cards);
//   //       setCategory(new Category(cachedThreads[0].category_id, cachedThreads[0].category_name));
//   //     }

//   //     // 2. Check network
//   //     const online = await isOnHomeWiFi();
//   //     setIsOnline(online);

//   //     // 3. If online, fetch fresh data from GraphQL
//   //     if (online) {
//   //       if (categoryId && categoryId.length > 0) {
//   //         execGetThreadsByCat({ variables: { categoryId } });
//   //       } else {
//   //         execGetThreadsLatest();
//   //       }
//   //     } else if (!cachedThreads || cachedThreads.length === 0) {
//   //       // If offline and nothing in DB, clear UI
//   //       setThreadCards(null);
//   //       setCategory(undefined);
//   //     }
//   //   };
    
//   //   loadData();
//   //   // eslint-disable-next-line react-hooks/exhaustive-deps
//   // }, [categoryId]);

//   // When GraphQL returns data (Online), render and cache it!
//   useEffect(() => {
//     if (
//       threadsByCatData &&
//       threadsByCatData.getThreadsByCategoryId &&
//       threadsByCatData.getThreadsByCategoryId.threads
//     ) {
//       const threads = threadsByCatData.getThreadsByCategoryId.threads;
      
//       // CACHE TO SQLITE
//       database.saveThreads(threads);

//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(threads[0].category);
//       setThreadCards(cards);
//     }
//   }, [threadsByCatData]);

//   // When GraphQL returns data (Online), render and cache it!
//   useEffect(() => {
//     if (
//       threadsLatestData &&
//       threadsLatestData.getThreadsLatest &&
//       threadsLatestData.getThreadsLatest.threads
//     ) {
//       const threads = threadsLatestData.getThreadsLatest.threads;
      
//       // CACHE TO SQLITE
//       database.saveThreads(threads);

//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(new Category("0", "Latest"));
//       setThreadCards(cards);
//     }
//   }, [threadsLatestData]);

//   const onClickPostThread = () => {
//     navigate("/thread");
//   };

//   return (
//     <main className="content">
//       {isOnline && (
//         <button className="action-btn" onClick={onClickPostThread}>
//           Create a New Topic
//         </button>
//       )}
//       {!isOnline && (
//         <div style={{ padding: '10px', backgroundColor: '#FFF3CD', marginBottom: '10px', borderRadius: '5px' }}>
//           <span>📡 Offline Mode - Viewing cached conversations</span>
//         </div>
//       )}
//       <MainHeader category={category} />
//       <div>{threadCards}</div>
//     </main>
//   );
// };

// export default Main;

// import React, { useEffect, useState } from "react";
// import MainHeader from "./MainHeader";
// import { useNavigate, useParams } from "react-router-dom";
// import ThreadCard from "./ThreadCard";
// import Category from "../../../models/Category";
// import { gql, useLazyQuery } from "@apollo/client";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// const GetThreadsByCategoryId = gql`
//   query getThreadsByCategoryId($categoryId: ID!) {
//     getThreadsByCategoryId(categoryId: $categoryId) {
//       ... on EntityResult {
//         messages
//       }
//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;

// const GetThreadsLatest = gql`
//   query getThreadsLatest {
//     getThreadsLatest {
//       ... on EntityResult {
//         messages
//       }
//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;

// const Main = () => {
//   const [
//     execGetThreadsByCat,
//     { data: threadsByCatData }
//   ] = useLazyQuery(GetThreadsByCategoryId);
  
//   const [
//     execGetThreadsLatest,
//     { data: threadsLatestData }
//   ] = useLazyQuery(GetThreadsLatest);
  
//   const { categoryId } = useParams();
//   const [category, setCategory] = useState<Category | undefined>();
//   const [threadCards, setThreadCards] = useState<Array<React.JSX.Element> | null>(null);
//   const [isOnline, setIsOnline] = useState(true);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const loadData = async () => {
//       // Check network for the UI banner, but DO NOT block the fetch
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       // Always try to fetch from GraphQL. If offline, Apollo will fail silently and we fall back to SQLite.
//       if (categoryId && categoryId.length > 0) {
//         execGetThreadsByCat({ variables: { categoryId } });
//       } else {
//         execGetThreadsLatest();
//       }

//       // If we are offline, immediately load from SQLite to show cached data
//       if (!online) {
//         const cachedThreads = await database.getThreads(categoryId);
//         if (cachedThreads && cachedThreads.length > 0) {
//           const cards = cachedThreads.map((th: any) => {
//             const threadObj = {
//               id: th.id,
//               title: th.title,
//               body: th.body,
//               views: 0,
//               points: th.points,
//               createdOn: th.created_at,
//               lastModifiedOn: th.created_at,
//               user: { userName: th.user_name },
//               threadItems: [],
//               category: { id: th.category_id, name: th.category_name }
//             };
//             return <ThreadCard key={`thread-${th.id}`} thread={threadObj as any} />;
//           });
//           setThreadCards(cards);
//           setCategory(new Category(cachedThreads[0].category_id, cachedThreads[0].category_name));
//         } else {
//           setThreadCards(null);
//           setCategory(undefined);
//         }
//       }
//     };
    
//     loadData();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [categoryId]);

//   // When GraphQL returns data (Online), render and cache it!
//   useEffect(() => {
//     if (
//       threadsByCatData &&
//       threadsByCatData.getThreadsByCategoryId &&
//       threadsByCatData.getThreadsByCategoryId.threads
//     ) {
//       const threads = threadsByCatData.getThreadsByCategoryId.threads;
      
//       // CACHE TO SQLITE
//       database.saveThreads(threads);

//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(threads[0].category);
//       setThreadCards(cards);
//     }
//   }, [threadsByCatData]);

//   // When GraphQL returns data (Online), render and cache it!
//   useEffect(() => {
//     if (
//       threadsLatestData &&
//       threadsLatestData.getThreadsLatest &&
//       threadsLatestData.getThreadsLatest.threads
//     ) {
//       const threads = threadsLatestData.getThreadsLatest.threads;
      
//       // CACHE TO SQLITE
//       database.saveThreads(threads);

//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(new Category("0", "Latest"));
//       setThreadCards(cards);
//     }
//   }, [threadsLatestData]);

//   const onClickPostThread = () => {
//     navigate("/thread");
//   };

//   return (
//     <main className="content">
//       {isOnline && (
//         <button className="action-btn" onClick={onClickPostThread}>
//           Create a New Topic
//         </button>
//       )}
//       {!isOnline && (
//         <div style={{ padding: '10px', backgroundColor: '#FFF3CD', marginBottom: '10px', borderRadius: '5px' }}>
//           <span>📡 Offline Mode - Viewing cached conversations</span>
//         </div>
//       )}
//       <MainHeader category={category} />
//       <div>{threadCards}</div>
//     </main>
//   );
// };

// export default Main;


// import React, { useEffect, useState } from "react";
// import MainHeader from "./MainHeader";
// import { useNavigate, useParams } from "react-router-dom";
// import ThreadCard from "./ThreadCard";
// import Category from "../../../models/Category";
// import { gql, useLazyQuery } from "@apollo/client";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// const GetThreadsByCategoryId = gql`
//   query getThreadsByCategoryId($categoryId: ID!) {
//     getThreadsByCategoryId(categoryId: $categoryId) {
//       ... on EntityResult {
//         messages
//       }
//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;

// const GetThreadsLatest = gql`
//   query getThreadsLatest {
//     getThreadsLatest {
//       ... on EntityResult {
//         messages
//       }
//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;

// const Main = () => {
//   const [
//     execGetThreadsByCat,
//     {
//       //error: threadsByCatErr,
//       //called: threadsByCatCalled,
//       data: threadsByCatData,
//     }, 
//   ] = useLazyQuery(GetThreadsByCategoryId);
  
//   const [
//     execGetThreadsLatest,
//     {
//       // error: threadsLatestErr,
//       // called: threadsLatestCalled,
//       data: threadsLatestData,
//     },
//   ] = useLazyQuery(GetThreadsLatest);
  
//   const { categoryId } = useParams();
//   const [category, setCategory] = useState<Category | undefined>();
//   const [threadCards, setThreadCards] = useState<Array<React.JSX.Element> | null>(null);
//   const [isOnline, setIsOnline] = useState(false);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const checkNetworkAndLoad = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (online) {
//         // AT HOME: Use existing GraphQL logic
//         if (categoryId && categoryId.length > 0) {
//           execGetThreadsByCat({ variables: { categoryId } });
//         } else {
//           execGetThreadsLatest();
//         }
//       } else {
//         // OFFLINE: Read from local DB
//         const cachedThreads = await database.getThreads(categoryId);
//         if (cachedThreads && cachedThreads.length > 0) {
//           const cards = cachedThreads.map((th: any) => {
//             // Map flat SQLite rows back into nested objects expected by ThreadCard
//             const threadObj = {
//               id: th.id,
//               title: th.title,
//               body: th.body,
//               views: 0,
//               points: th.points,
//               createdOn: th.created_at, // FIX: Added missing property
//               lastModifiedOn: th.created_at, // FIX: Added missing property
//               user: { userName: th.user_name },
//               threadItems: [], // ThreadCard just checks length
//               category: { id: th.category_id, name: th.category_name }
//             };
//             return <ThreadCard key={`thread-${th.id}`} thread={threadObj as any} />;
//           });
//           setThreadCards(cards);
//           setCategory(new Category(cachedThreads[0].category_id, cachedThreads[0].category_name));
//         } else {
//           setThreadCards(null);
//           setCategory(undefined);
//         }
//       }
//     };
    
//     checkNetworkAndLoad();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [categoryId]);

//   useEffect(() => {
//     console.log("main threadsByCatData", threadsByCatData);
//     if (
//       threadsByCatData &&
//       threadsByCatData.getThreadsByCategoryId &&
//       threadsByCatData.getThreadsByCategoryId.threads
//     ) {
//       const threads = threadsByCatData.getThreadsByCategoryId.threads;
//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(threads[0].category);
//       setThreadCards(cards);
//     } else {
//       setCategory(undefined);
//       setThreadCards(null);
//     }
//   }, [threadsByCatData]);

//   useEffect(() => {
//     console.log("main threadsLatestCatData", threadsLatestData);
//     if (
//       threadsLatestData &&
//       threadsLatestData.getThreadsLatest &&
//       threadsLatestData.getThreadsLatest.threads
//     ) {
//       const threads = threadsLatestData.getThreadsLatest.threads;
//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(new Category("0", "Latest"));
//       setThreadCards(cards);
//     }
//   }, [threadsLatestData]);

//   const onClickPostThread = () => {
//     navigate("/thread");
//   };

//   return (
//     <main className="content">
//       {isOnline && (
//         <button className="action-btn" onClick={onClickPostThread}>
//           Create a New Topic
//         </button>
//       )}
//       {!isOnline && (
//         <div style={{ padding: '10px', backgroundColor: '#FFF3CD', marginBottom: '10px', borderRadius: '5px' }}>
//           <span>📡 Offline Mode - Viewing cached conversations</span>
//         </div>
//       )}
//       <MainHeader category={category} />
//       <div>{threadCards}</div>
//     </main>
//   );
// };

// export default Main;

// import React, { useEffect, useState } from "react";
// import MainHeader from "./MainHeader";
// import { useNavigate, useParams } from "react-router-dom";
// import ThreadCard from "./ThreadCard";
// // import { getThreadsByCategory } from "../../../services/DataService";
// import Category from "../../../models/Category";
// import { gql, useLazyQuery } from "@apollo/client";


// const GetThreadsByCategoryId = gql`
//   query getThreadsByCategoryId($categoryId: ID!) {
//     getThreadsByCategoryId(categoryId: $categoryId) {
//       ... on EntityResult {
//         messages
//       }

//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;
// const GetThreadsLatest = gql`
//   query getThreadsLatest {
//     getThreadsLatest {
//       ... on EntityResult {
//         messages
//       }

//       ... on ThreadArray {
//         threads {
//           id
//           title
//           body
//           views
//           points
//           user {
//             userName
//           }
//           threadItems {
//             id
//           }
//           category {
//             id
//             name
//           }
//         }
//       }
//     }
//   }
// `;



// const Main = () => {
//   const [
//   execGetThreadsByCat,
//   {
//     //error: threadsByCatErr,
//     //called: threadsByCatCalled,
//     data: threadsByCatData,
//   }, 
//   ] = useLazyQuery(GetThreadsByCategoryId);
//   const [
//     execGetThreadsLatest,
//     {
//       // error: threadsLatestErr,
//       // called: threadsLatestCalled,
//       data: threadsLatestData,
//     },
//   ] = useLazyQuery(GetThreadsLatest);
//   const { categoryId } = useParams();
//   const [category, setCategory] = useState<Category | undefined>();
//   const [threadCards, setThreadCards] = useState<Array<React.JSX.Element> | null>(
//     null
//   );
//   const navigate = useNavigate();

//   useEffect(() => {
//       if (categoryId && categoryId.length > 0) {
//         execGetThreadsByCat({
//           variables: {
//             categoryId,
//           },
//         });
//       } else {
//         execGetThreadsLatest();
//       }
//       // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [categoryId]);


//     useEffect(() => {
//     console.log("main threadsByCatData", threadsByCatData);
//     if (
//       threadsByCatData &&
//       threadsByCatData.getThreadsByCategoryId &&
//       threadsByCatData.getThreadsByCategoryId.threads
//     ) {
//       const threads = threadsByCatData.getThreadsByCategoryId.threads;
//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(threads[0].category);

//       setThreadCards(cards);
//     } else {
//       setCategory(undefined);
//       setThreadCards(null);
//     }
//   }, [threadsByCatData]);

//   useEffect(() => {
//     console.log("main threadsLatestCatData", threadsLatestData);
//     if (
//       threadsLatestData &&
//       threadsLatestData.getThreadsLatest &&
//       threadsLatestData.getThreadsLatest.threads
//     ) {
//       const threads = threadsLatestData.getThreadsLatest.threads;
//       const cards = threads.map((th: any) => {
//         return <ThreadCard key={`thread-${th.id}`} thread={th} />;
//       });

//       setCategory(new Category("0", "Latest"));

//       setThreadCards(cards);
//     }
//   }, [threadsLatestData]);

//   const onClickPostThread = () => {
//     navigate("/thread");
//   };

//   return (
//     <main className="content">
//       <button className="action-btn" onClick={onClickPostThread}>
//         Create a New Topic
//       </button>
//       <MainHeader category={category} />
//       <div>{threadCards}</div>
//     </main>
//   );
// };

// //   useEffect(() => {
// //     console.log("main categoryId", categoryId);

// //     if (categoryId && categoryId.length > 0) {
// //       getThreadsByCategory(categoryId).then((threads) => {
// //         const cards = threads.map((th) => {
// //           return <ThreadCard key={`thread-${th.id}`} thread={th} />;
// //         });
// //         if (!category) {
// //           setCategory(threads[0].category);
// //         }
// //         setThreadCards(cards);
// //       });
// //     }
// //   }, [categoryId]);

// //   return (
// //     <main className="content">
// //       <MainHeader category={category} />
// //       <div>{threadCards}</div>
// //     </main>
// //   );
// // };

// export default Main;