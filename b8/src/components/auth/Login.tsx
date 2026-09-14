import React, { FC, useReducer } from "react";
import ReactModal from "react-modal";
import ModalProps from "../types/ModalProps";
import userReducer from "./common/UserReducer";
import { allowSubmit } from "./common/Helpers";
import { gql, useMutation } from "@apollo/client";
import useRefreshReduxMe, { Me } from "../../hooks/useRefreshReduxMe";

const LoginMutation = gql`
  mutation Login($userName: String!, $password: String!) {
    login(userName: $userName, password: $password)
  }
`;

const Login: FC<ModalProps> = ({ isOpen, onClickToggle }) => {
  const [execLogin] = useMutation(LoginMutation, {
    refetchQueries: [
      {
        query: Me,
      },
    ],
  });
  const [
    { userName, password, resultMsg, isSubmitDisabled },
    dispatch,
  ] = useReducer(userReducer, {
    userName: "test1",
    password: "Test123$%^",
    resultMsg: "",
    isSubmitDisabled: false,
  });
  const { execMe, updateMe } = useRefreshReduxMe();

  const onChangeUserName = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "userName", payload: e.target.value });
    if (!e.target.value)
      allowSubmit(dispatch, "Username cannot be empty", true);
    else allowSubmit(dispatch, "", false);
  };

  const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "password", payload: e.target.value });
    if (!e.target.value)
      allowSubmit(dispatch, "Password cannot be empty", true);
    else allowSubmit(dispatch, "", false);
  };

  const onClickLogin = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault();
    console.log('🔐 === LOGIN START ===');
    
    try {
      onClickToggle(e);
      const result = await execLogin({
        variables: { userName, password },
      });
      
      console.log("login result:", result);
      
      console.log('🔄 Calling execMe...');
      // FIX: Cast to any to bypass strict hook typing
      const meResult: any = await execMe();
      console.log('🔄 execMe executed, result:', meResult);
      
      // Wait for data to load, then update Redux
      setTimeout(() => {
        console.log('🔄 Calling updateMe after delay...');
        updateMe();
        
        // Save user data to localStorage for offline/remote access (Phase 3 Prep)
        const userData = meResult?.data?.me;
        if (userData) {
          const userId = userData.id || userData.user?.id;
          const fetchedUserName = userData.userName || userData.user?.userName || userName;
          
          if (userId) localStorage.setItem('b8_user_id', userId);
          if (fetchedUserName) localStorage.setItem('b8_user_name', fetchedUserName);
        } else {
          // Fallback to the entered username if query structure is unexpected
          localStorage.setItem('b8_user_name', userName);
        }
      }, 500);
      
    } catch (error) {
      console.error("❌ Login failed:", error);
    }
  };

  const onClickCancel = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    onClickToggle(e);
  };

  return (
    <ReactModal
      className="modal-menu"
      isOpen={isOpen}
      onRequestClose={onClickToggle}
      shouldCloseOnOverlayClick={true}
    >
      <form>
        <div className="reg-inputs">
          <div>
            <label>username</label>
            <input type="text" value={userName} onChange={onChangeUserName} />
          </div>
          <div>
            <label>password</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={onChangePassword}
            />
          </div>
        </div>
        <div className="form-buttons form-buttons-sm">
          <div className="form-btn-left">
            <button
              style={{ marginLeft: ".5em" }}
              className="action-btn"
              disabled={isSubmitDisabled}
              onClick={onClickLogin}
            >
              Login
            </button>
            <button
              style={{ marginLeft: ".5em" }}
              className="cancel-btn"
              onClick={onClickCancel}
            >
              Close
            </button>
          </div>

          <span className="form-btn-left">
            <strong>{resultMsg}</strong>
          </span>
        </div>
      </form>
    </ReactModal>
  );
};

export default Login;

// import React, { FC, useReducer } from "react";
// import ReactModal from "react-modal";
// import ModalProps from "../types/ModalProps";
// import userReducer from "./common/UserReducer";
// import { allowSubmit } from "./common/Helpers";
// import { gql, useMutation } from "@apollo/client";
// import useRefreshReduxMe, { Me } from "../../hooks/useRefreshReduxMe";

// const LoginMutation = gql`
//   mutation Login($userName: String!, $password: String!) {
//     login(userName: $userName, password: $password)
//   }
// `;

// const Login: FC<ModalProps> = ({ isOpen, onClickToggle }) => {
//   const [execLogin] = useMutation(LoginMutation, {
//     refetchQueries: [
//       {
//         query: Me,
//       },
//     ],
//   });
//   const [
//     { userName, password, resultMsg, isSubmitDisabled },
//     dispatch,
//   ] = useReducer(userReducer, {
//     userName: "test1",
//     password: "Test123$%^",
//     resultMsg: "",
//     isSubmitDisabled: false,
//   });
//   const { execMe, updateMe } = useRefreshReduxMe();

//   const onChangeUserName = (e: React.ChangeEvent<HTMLInputElement>) => {
//     dispatch({ type: "userName", payload: e.target.value });
//     if (!e.target.value)
//       allowSubmit(dispatch, "Username cannot be empty", true);
//     else allowSubmit(dispatch, "", false);
//   };

//   const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
//     dispatch({ type: "password", payload: e.target.value });
//     if (!e.target.value)
//       allowSubmit(dispatch, "Password cannot be empty", true);
//     else allowSubmit(dispatch, "", false);
//   };

// const onClickLogin = async (
//   e: React.MouseEvent<HTMLButtonElement, MouseEvent>
// ) => {
//   e.preventDefault();
//   console.log('🔐 === LOGIN START ===');
//   console.log('1. Before login - token:', localStorage.getItem('authToken'));
  
//   try {
//     onClickToggle(e);
//     const result = await execLogin({
//       variables: {
//         userName,
//         password,
//       },
//     });
    
//     console.log('2. Login result:', result);
//     console.log('3. Login data:', result.data?.login);
    
//     // Check what's actually returned
//     if (result.data?.login) {
//       console.log('4. ✅ Got login response, storing token...');
//       localStorage.setItem('authToken', result.data.login);
//       console.log('5. After storage - token:', localStorage.getItem('authToken'));
//     } else {
//       console.log('4. ❌ No token in response');
//     }
    
//     console.log('6. Calling execMe and updateMe...');
//     execMe();
//     updateMe();
    
//     console.log('7. === LOGIN END ===');
    
//   } catch (error) {
//     console.error('❌ Login error:', error);
//   }
// };


// const onClickLogin = async (
//   e: React.MouseEvent<HTMLButtonElement, MouseEvent>
// ) => {
//   e.preventDefault();
//   onClickToggle(e);
  
//   try {
//     const result = await execLogin({
//       variables: {
//         userName,
//         password,
//       },
//     });
    
//     console.log("login", result);
    
//     // Instead of relying on refetchQueries, do manual refresh
//     setTimeout(() => {
//       execMe();
//       updateMe();
      
//       // Force a hard refresh after a delay
//       setTimeout(() => {
//         window.location.reload();
//       }, 1000);
//     }, 500);
    
//   } catch (error) {
//     console.error("Login failed:", error);
//   }
// };


// const onClickLogin = async (
//   e: React.MouseEvent<HTMLButtonElement, MouseEvent>
// ) => {
//   e.preventDefault();
//   console.log('🔐 === LOGIN START ===');
  
//   try {
//     onClickToggle(e);
//     const result = await execLogin({
//       variables: { userName, password },
//     });
    
//     console.log("login result:", result);
    
//     console.log('🔄 Calling execMe...');
//     // Execute Me query
//     const meResult = await execMe();
//     console.log('🔄 execMe executed, result:', meResult);
    
//     // Wait for data to load, then update Redux
//     setTimeout(() => {
//       console.log('🔄 Calling updateMe after delay...');
//       updateMe();
//     }, 500);
    
//   } catch (error) {
//     console.error("❌ Login failed:", error);
//   }
// };



// const onClickLogin = async (
//   e: React.MouseEvent<HTMLButtonElement, MouseEvent>
// ) => {
//   e.preventDefault();
//   onClickToggle(e);
  
//   const result = await execLogin({
//     variables: {
//       userName,
//       password,
//     },
//   });
  
//   console.log("login", result);
  
//   // REMOVED: localStorage.setItem('authToken', result.data.login);
  
//   execMe();
//   updateMe();
// };

  // const onClickLogin = async (
  //   e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  // ) => {
  //   e.preventDefault();
  //   onClickToggle(e);
  //   const result = await execLogin({
  //     variables: {
  //       userName,
  //       password,
  //     },
  //   });
  //   console.log("login", result);
  //   execMe();
  //   updateMe();
  // };

//   const onClickCancel = (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     onClickToggle(e);
//   };

//   return (
//     <ReactModal
//       className="modal-menu"
//       isOpen={isOpen}
//       onRequestClose={onClickToggle}
//       shouldCloseOnOverlayClick={true}
//     >
//       <form>
//         <div className="reg-inputs">
//           <div>
//             <label>username</label>
//             <input type="text" value={userName} onChange={onChangeUserName} />
//           </div>
//           <div>
//             <label>password</label>
//             <input
//               type="password"
//               placeholder="Password"
//               value={password}
//               onChange={onChangePassword}
//             />
//           </div>
//         </div>
//         <div className="form-buttons form-buttons-sm">
//           <div className="form-btn-left">
//             <button
//               style={{ marginLeft: ".5em" }}
//               className="action-btn"
//               disabled={isSubmitDisabled}
//               onClick={onClickLogin}
//             >
//               Login
//             </button>
//             <button
//               style={{ marginLeft: ".5em" }}
//               className="cancel-btn"
//               onClick={onClickCancel}
//             >
//               Close
//             </button>
//           </div>

//           <span className="form-btn-left">
//             <strong>{resultMsg}</strong>
//           </span>
//         </div>
//       </form>
//     </ReactModal>
//   );
// };

// export default Login;







// import React, { FC, useReducer, useEffect } from "react";
// import ReactModal from "react-modal";
// import ModalProps from "../types/ModalProps";
// import userReducer from "./common/UserReducer";
// import { allowSubmit } from "./common/Helpers";
// import { useDispatch } from "react-redux";
// import { UserProfileSetType } from "../../store/user/Reducer";

// const Login: FC<ModalProps> = ({ isOpen, onClickToggle }) => {
//   const [
//     { userName, password, resultMsg, isSubmitDisabled },
//     dispatch,
//   ] = useReducer(userReducer, {
//     userName: "",
//     password: "",
//     resultMsg: "",
//     isSubmitDisabled: true,
//   });
//   const reduxDispatch = useDispatch();

//   useEffect(() => {
//     // todo: replace with GraphQL call
//     reduxDispatch({
//       type: UserProfileSetType,
//       payload: {
//         id: 1,
//         userName: "testUser",
//       },
//     });
//   }, [reduxDispatch]);

//   const onChangeUserName = (e: React.ChangeEvent<HTMLInputElement>) => {
//     dispatch({ type: "userName", payload: e.target.value });
//     if (!e.target.value)
//       allowSubmit(dispatch, "Username cannot be empty", true);
//     else allowSubmit(dispatch, "", false);
//   };

//   const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
//     dispatch({ type: "password", payload: e.target.value });
//     if (!e.target.value)
//       allowSubmit(dispatch, "Password cannot be empty", true);
//     else allowSubmit(dispatch, "", false);
//   };

//   const onClickLogin = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
//     e.preventDefault();
//     onClickToggle(e);
//   };

//   const onClickCancel = (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     onClickToggle(e);
//   };

//   return (
//     <ReactModal
//       className="modal-menu"
//       isOpen={isOpen}
//       onRequestClose={onClickToggle}
//       shouldCloseOnOverlayClick={true}
//     >
//       <form>
//         <div className="reg-inputs">
//           <div>
//             <label>username</label>
//             <input type="text" value={userName} onChange={onChangeUserName} />
//           </div>
//           <div>
//             <label>password</label>
//             <input
//               type="password"
//               placeholder="Password"
//               value={password}
//               onChange={onChangePassword}
//             />
//           </div>
//         </div>
//         <div className="form-buttons form-buttons-sm">
//           <div className="form-btn-left">
//             <button
//               style={{ marginLeft: ".5em" }}
//               className="action-btn"
//               disabled={isSubmitDisabled}
//               onClick={onClickLogin}
//             >
//               Login
//             </button>
//             <button
//               style={{ marginLeft: ".5em" }}
//               className="cancel-btn"
//               onClick={onClickCancel}
//             >
//               Close
//             </button>
//           </div>

//           <span className="form-btn-left">
//             <strong>{resultMsg}</strong>
//           </span>
//         </div>
//       </form>
//     </ReactModal>
//   );
// };

// export default Login;