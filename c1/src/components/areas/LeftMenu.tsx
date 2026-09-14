// import React, { useEffect, useState } from "react";
// import { useWindowDimensions } from "../../hooks/useWindowDimensions";
// import "./LeftMenu.css";
// import { Link } from "react-router-dom";
// import { gql, useQuery } from "@apollo/client";
// import { database } from "../../db/Database";

// const GetAllCategories = gql`
//   query getAllCategories {
//     getAllCategories {
//       id
//       name
//     }
//   }
// `;

// const LeftMenu = () => {
//   const { data } = useQuery(GetAllCategories);
//   const { width } = useWindowDimensions();
//   const [categories, setCategories] = useState<React.JSX.Element>(
//     <div>Left Menu</div>
//   );

//   useEffect(() => {
//     const loadCategories = async () => {
//       // 1. INSTANTLY load from SQLite so they are always visible
//       try {
//         const cachedCats = await database.getCategories();
//         if (cachedCats && cachedCats.length > 0) {
//           const cats = cachedCats.map((cat: any) => (
//             <li key={cat.id}>
//               <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//             </li>
//           ));
//           setCategories(<ul className="category">{cats}</ul>);
//         }
//       } catch (e) {
//         console.error("SQLite read error", e);
//       }

//       // 2. If GraphQL fetches new data (online), update UI and cache it
//       if (data?.getAllCategories) {
//         const cats = data.getAllCategories.map((cat: any) => (
//           <li key={cat.id}>
//             <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//           </li>
//         ));
//         setCategories(<ul className="category">{cats}</ul>);
//         try {
//           await database.saveCategories(data.getAllCategories);
//         } catch (e) {
//           console.error("SQLite save error", e);
//         }
//       }
//     };

//     loadCategories();
//   }, [data]);

//   // FIX: Removed the width <= 768 check so the menu ALWAYS renders
//   return <div className="leftmenu leftmenu-container">{categories}</div>;
// };

// export default LeftMenu;

import React, { useEffect, useState } from "react";
import { useWindowDimensions } from "../../hooks/useWindowDimensions";
import "./LeftMenu.css";
import { Link } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import { database } from "../../db/Database";

const GetAllCategories = gql`
  query getAllCategories {
    getAllCategories {
      id
      name
    }
  }
`;

const LeftMenu = () => {
  const { data } = useQuery(GetAllCategories);
  const { width } = useWindowDimensions();
  const [categories, setCategories] = useState<React.JSX.Element>(
    <div>Left Menu</div>
  );

  useEffect(() => {
    const loadCategories = async () => {
      // 1. If GraphQL fetches new data (online), update UI and cache it
      if (data?.getAllCategories) {
        const cats = data.getAllCategories.map((cat: any) => (
          <li key={cat.id}>
            <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
          </li>
        ));
        setCategories(<ul className="category">{cats}</ul>);
        try {
          await database.saveCategories(data.getAllCategories);
        } catch (e) {
          console.error("SQLite save error", e);
        }
      } else {
        // 2. Fallback to SQLite if no GraphQL data yet (offline)
        try {
          const cachedCats = await database.getCategories();
          if (cachedCats && cachedCats.length > 0) {
            const cats = cachedCats.map((cat: any) => (
              <li key={cat.id}>
                <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
              </li>
            ));
            setCategories(<ul className="category">{cats}</ul>);
          }
        } catch (e) {
          console.error("SQLite read error", e);
        }
      }
    };

    loadCategories();
  }, [data]);

  // useEffect(() => {
  //   const loadCategories = async () => {
  //     // 1. INSTANTLY load from SQLite so they are always visible
  //     const cachedCats = await database.getCategories();
  //     console.log("LeftMenu: Loaded from SQLite:", cachedCats); // ADD THIS
  //     if (cachedCats && cachedCats.length > 0) {
  //       const cats = cachedCats.map((cat: any) => (
  //         <li key={cat.id}>
  //           <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
  //         </li>
  //       ));
  //       setCategories(<ul className="category">{cats}</ul>);
  //     }

  //     // 2. If GraphQL fetches new data (online), update UI and cache it
  //     if (data?.getAllCategories) {
  //       const cats = data.getAllCategories.map((cat: any) => (
  //         <li key={cat.id}>
  //           <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
  //         </li>
  //       ));
  //       setCategories(<ul className="category">{cats}</ul>);
  //       await database.saveCategories(data.getAllCategories);
  //     }
  //   };

  //   loadCategories();
  // }, [data]);

  if (width <= 768) {
    return null;
  }
  
  return <div className="leftmenu leftmenu-container">{categories}</div>;
};

export default LeftMenu;

// import React, { useEffect, useState } from "react";
// import { useWindowDimensions } from "../../hooks/useWindowDimensions";
// import "./LeftMenu.css";
// import { Link } from "react-router-dom";
// import { gql, useQuery } from "@apollo/client";
// import { database } from "../../db/Database";

// const GetAllCategories = gql`
//   query getAllCategories {
//     getAllCategories {
//       id
//       name
//     }
//   }
// `;

// const LeftMenu = () => {
//   const { data } = useQuery(GetAllCategories);
//   const { width } = useWindowDimensions();
//   const [categories, setCategories] = useState<React.JSX.Element>(
//     <div>Left Menu</div>
//   );

//   useEffect(() => {
//     const loadCategories = async () => {
//       // 1. If GraphQL successfully fetched data, render it AND cache it
//       if (data?.getAllCategories) {
//         const cats = data.getAllCategories.map((cat: any) => (
//           <li key={cat.id}>
//             <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//           </li>
//         ));
//         setCategories(<ul className="category">{cats}</ul>);
        
//         // Save to SQLite immediately
//         await database.saveCategories(data.getAllCategories);
//       } else {
//         // 2. If no GraphQL data (offline), try reading from SQLite
//         const cachedCats = await database.getCategories();
//         if (cachedCats && cachedCats.length > 0) {
//           const cats = cachedCats.map((cat: any) => (
//             <li key={cat.id}>
//               <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//             </li>
//           ));
//           setCategories(<ul className="category">{cats}</ul>);
//         } else {
//           setCategories(<span>Loading categories...</span>);
//         }
//       }
//     };

//     loadCategories();
//   }, [data]);

//   if (width <= 768) {
//     return null;
//   }
  
//   return <div className="leftmenu leftmenu-container">{categories}</div>;
// };

// export default LeftMenu;

// import React, { useEffect, useState, useCallback } from "react";
// import { useWindowDimensions } from "../../hooks/useWindowDimensions";
// import "./LeftMenu.css";
// import { Link } from "react-router-dom";
// import { gql, useQuery } from "@apollo/client";
// import { database } from "../../db/Database";
// import { isOnHomeWiFi } from "../../utils/network";

// const GetAllCategories = gql`
//   query getAllCategories {
//     getAllCategories {
//       id
//       name
//     }
//   }
// `;

// const LeftMenu = () => {
//   const { data } = useQuery(GetAllCategories);
//   const { width } = useWindowDimensions();
//   const [categories, setCategories] = useState<React.JSX.Element>(
//     <div>Left Menu</div>
//   );

//   const checkNetworkAndLoad = useCallback(async () => {
//     const online = await isOnHomeWiFi();

//     if (online && data?.getAllCategories) {
//       // Online: Use GraphQL data and cache to local DB
//       const cats = data.getAllCategories.map((cat: any) => {
//         return <li key={cat.id}>
//           <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//         </li>;
//       });
//       setCategories(<ul className="category">{cats}</ul>);
//       await database.saveCategories(data.getAllCategories);
//     } else {
//       // Offline: Read from local DB
//       const cachedCats = await database.getCategories();
//       if (cachedCats && cachedCats.length > 0) {
//         const cats = cachedCats.map((cat: any) => {
//           return <li key={cat.id}>
//             <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//           </li>;
//         });
//         setCategories(<ul className="category">{cats}</ul>);
//       } else if (!online) {
//         setCategories(<span>📡 Offline - Connect to WiFi to load categories</span>);
//       }
//     }
//   }, [data]);

//   useEffect(() => {
//     checkNetworkAndLoad();
//   }, [checkNetworkAndLoad]);

//   if (width <= 768) {
//     return null;
//   }
  
//   return <div className="leftmenu leftmenu-container">{categories}</div>;
// };

// export default LeftMenu;

// import React, { useEffect, useState } from "react";
// import { useWindowDimensions } from "../../hooks/useWindowDimensions";
// import "./LeftMenu.css";
// import { Link } from "react-router-dom";
// // import { useSelector } from "react-redux";
// // import { AppState } from "../../store/AppState";
// // import Category from "../../models/Category";
// import { gql, useQuery } from "@apollo/client";


// const GetAllCategories = gql`
//   query getAllCategories {
//     getAllCategories {
//       id
//       name
//     }
//   }
// `;

// const LeftMenu = () => {
//   const { loading, error, data } = useQuery(GetAllCategories);
//   // const categoriesState = useSelector((state: AppState) => state.categories);
//   const { width } = useWindowDimensions();
//   const [categories, setCategories] = useState<React.JSX.Element>(
//     <div>Left Menu</div>
//   );

//   useEffect(() => {
//   if (loading) {
//     setCategories(<span>Loading ...</span>);
//   } else if (error) {
//     setCategories(<span>Error occurred loading categories ...</span>);
//   } else {
//     if (data && data.getAllCategories) {
//       const cats = data.getAllCategories.map((cat: any) => {
//         return <li key={cat.id}>
//         <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//       </li>;
//       });
//     setCategories(<ul className="category">{cats}</ul>);
//     }
//   } 
//   }, [data]);

//   // useEffect(() => {
//   //   if (categoriesState) {
//   //     console.log(categoriesState);
//   //     const cats = categoriesState.map((cat: Category) => {
//   //       return (
//   //         <li key={cat.id}>
//   //           <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//   //         </li>
//   //       );
//   //     });
//   //     setCategories(<ul className="category">{cats}</ul>);
//   //   }
//   // }, [categoriesState]);

//   if (width <= 768) {
//     return null;
//   }
//   return <div className="leftmenu leftmenu-container">{categories}</div>;
// };
// export default LeftMenu;






// import React, { useEffect, useState } from "react";
// import { Link } from 'react-router-dom';
// import { useWindowDimensions } from "../../hooks/useWindowDimensions";
// import { getCategories } from "../../services/DataService";
// import Category from "../../models/Category";
// import "./LeftMenu.css";
// import { gql, useQuery } from "@apollo/client";

// const GetAllCategories = gql`
//   query getAllCategories {
//     getAllCategories {
//       id
//       name
//     }
//   }
// `;

// const LeftMenu = () => {
//   const { loading, error, data } = useQuery(GetAllCategories);
//   const { width } = useWindowDimensions();
//   const [categories, setCategories] = useState<React.JSX.Element>(
//     <div>Left Menu</div>
//   );

//   useEffect(() => {
//     if (loading) {

//         setCategories(<span>Loading ...</span>);
//     } else if (error) {
//       setCategories(<span>Error occurred loading categories ...</span>);
//        } else {
//       if (data && data.getAllCategories) {
//         const cats = data.getAllCategories.map((cat: any) => {
//           return <li key={cat.id}>
//         <Link to={`/categorythreads/${cat.id}`}>{cat.name}</Link>
//        </li>;
//         });
//         setCategories(<ul className="category">{cats} </ul>);
//       }
//     }
//     // "eslint-disable-next-line react-hooks/exhaustive-
//     // deps
//   }, [data]);
//   if (width <= 768) {
//     return null;
//   }
//   return <div className="leftmenu">{categories}</div>;
// };

// export default LeftMenu;

  //   getCategories()
  //     .then((categories: Array<Category>) => {
  //       const cats = categories.map((cat) => {
  //         return <li key={cat.id}>{cat.name}</li>;
  //       });
  //       setCategories(<ul className="category">{cats}</ul>);
  //     })
  //     .catch((err) => {
  //       console.log(err);
  //     });
  // }, []);

//   if (width <= 768) {
//     return null;
//   }
//   return <div className="leftmenu">{categories}</div>;
// };

// export default LeftMenu;