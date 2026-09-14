import { gql, QueryLazyOptions, useLazyQuery } from "@apollo/client";
import { useDispatch } from "react-redux";
import { UserProfileSetType } from "../store/user/Reducer";

export const Me = gql`
  query me {
    me {
      ... on EntityResult {
        messages
      }
      ... on User {
        id
        userName
        threads {
          id
          title
        }
        threadItems {
          id
          thread {
            id
          }
          body
          aiResponse
        }
      }
    }
  }
`;

interface UseRefreshReduxMeResult {
  execMe: (options?: QueryLazyOptions<Record<string, any>> | undefined) => void;
  deleteMe: () => void;
  updateMe: () => void;
}

const useRefreshReduxMe = (): UseRefreshReduxMeResult => {
  const [execMe, { data }] = useLazyQuery(Me);
  const reduxDispatcher = useDispatch();

  console.log('🔄 useRefreshReduxMe - Current data:', data);
  console.log('🔄 useRefreshReduxMe - Has user data:', !!data?.me);
  console.log('🔄 useRefreshReduxMe - User name exists:', !!data?.me?.userName);

  const deleteMe = () => {
    console.log('🗑️ deleteMe - Clearing user from Redux');
    reduxDispatcher({
      type: UserProfileSetType,
      payload: null,
    });
  };

  const updateMe = () => {
    console.log('📝 updateMe - Checking data for Redux update');
    console.log('📝 updateMe - Data structure:', {
      hasData: !!data,
      hasMe: !!data?.me,
      hasUserName: !!data?.me?.userName,
      fullData: data
    });

    if (data && data.me && data.me.userName) {
      console.log('✅ updateMe - Dispatching user to Redux:', data.me);
      reduxDispatcher({
        type: UserProfileSetType,
        payload: data.me,
      });
    } else {
      console.log('❌ updateMe - No valid user data available');
      if (data?.me?.messages) {
        console.log('❌ updateMe - Server messages:', data.me.messages);
      }
    }
  };

  return { execMe, deleteMe, updateMe };
};

export default useRefreshReduxMe;

// import { gql, QueryLazyOptions, useLazyQuery } from "@apollo/client";
// import { useDispatch } from "react-redux";
// import { UserProfileSetType } from "../store/user/Reducer";

// export const Me = gql`
//   query me {
//     me {
//       ... on EntityResult {
//         messages
//       }
//       ... on User {
//         id
//         userName
//         threads {
//           id
//           title
//         }
//         threadItems {
//           id
//           thread {
//             id
//           }
//           body
//           aiResponse
//         }
//       }
//     }
//   }
// `;



// interface UseRefreshReduxMeResult {
//   execMe: (options?: QueryLazyOptions<Record<string, any>> | undefined) => void;
//   deleteMe: () => void;
//   updateMe: () => void;
// }

// const useRefreshReduxMe = (): UseRefreshReduxMeResult => {
//   const [execMe, { data }] = useLazyQuery(Me);
//   const reduxDispatcher = useDispatch();

//   const deleteMe = () => {
//     reduxDispatcher({
//       type: UserProfileSetType,
//       payload: null,
//     });
//   };
//   const updateMe = () => {
//     if (data && data.me && data.me.userName) {
//       reduxDispatcher({
//         type: UserProfileSetType,
//         payload: data.me,
//       });
//     }
//   };

//   return { execMe, deleteMe, updateMe };
// };
// export default useRefreshReduxMe;