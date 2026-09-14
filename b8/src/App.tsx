import React, { useEffect } from "react";
import "./App.css";
import { Routes, Route } from "react-router-dom";
import Home from "./components/routes/Home";
import Thread from "./components/routes/thread/Thread";
import UserProfile from "./components/routes/userProfile/UserProfile";
import { useDispatch } from "react-redux";
import { gql, useQuery } from "@apollo/client";
import { ThreadCategoriesType } from "./store/categories/Reducer";
import useRefreshReduxMe from "./hooks/useRefreshReduxMe";

const GetAllCategories = gql`
  query getAllCategories {
    getAllCategories {
      id
      name
    }
  }
`;

function App() {
  const { data: categoriesData } = useQuery(GetAllCategories);
  const { execMe, updateMe } = useRefreshReduxMe();
  const dispatch = useDispatch();

  useEffect(() => {
    execMe();
  }, [execMe]);

  useEffect(() => {
    updateMe();
  }, [updateMe]);

  useEffect(() => {
    // dispatch({
    //   // type: UserProfileSetType,
    //   type: ThreadCategoriesType,
    //   payload: {
    //     id: 1,
    //     userName: "testUser",
    //   },
    // });
    if (categoriesData && categoriesData.getAllCategories) {
      dispatch({
        type: ThreadCategoriesType,
        payload: categoriesData.getAllCategories,
      });
    }
  }, [dispatch, categoriesData]);

 
// import React, { useEffect } from "react";
// import "./App.css";
// import { Routes, Route } from "react-router-dom";
// import Home from "./components/routes/Home";
// import Thread from "./components/routes/thread/Thread";
// import UserProfile from "./components/routes/userProfile/UserProfile";
// import { useDispatch } from "react-redux";
// import { UserProfileSetType } from "./store/user/Reducer";
// import { ThreadCategoriesType } from "./store/categories/Reducer";
// import { gql, useQuery } from "@apollo/client";




//  const GetAllCategories = gql`
//   query getAllCategories {
//     getAllCategories {
//       id
//       name
//     }
//   }
// `;

// function App() {
//   const { data } = useQuery(GetAllCategories);
//   const dispatch = useDispatch();
//   useEffect(() => {
//     dispatch({
//       type: UserProfileSetType,
//       payload: {
//         id: 1,
//         userName: "testUser",
//       },
//     });
//     if (data && data.getAllCategories) {
//       dispatch({
//         type: ThreadCategoriesType, 
//         payload: data.getAllCategories,
//       });
//     }
//   }, [dispatch, data]);

  // const dispatch = useDispatch();

  // useEffect(() => {
  //   // todo: replace with GraphQL call
  //   dispatch({
  //     type: UserProfileSetType,
  //     payload: {
  //       id: 1,
  //       userName: "testUser",
  //     },
  //   });
  // }, [dispatch]);

  /* const renderHome = (props: any) => <Home {...props} />;
  const renderThread = (props: any) => <Thread {...props} />;
  const renderUserProfile = (props: any) => <UserProfile {...props} />;
 */
  return (
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/categorythreads/:categoryId" element={<Home/>} />
      <Route path="/thread/:id?" element={<Thread/>} />
      <Route path="/userprofile/:id" element={<UserProfile/>} />
    </Routes>
  );
}

export default App;