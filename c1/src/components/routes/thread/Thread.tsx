import React, { useEffect, useReducer, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Thread.css";
import ThreadHeader from "./ThreadHeader";
import ThreadCategory from "./ThreadCategory";
import ThreadTitle from "./ThreadTitle";
import ThreadModel from "../../../models/Thread";
import Nav from "../../areas/Nav";
import ThreadBody from "./ThreadBody";
import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
import ThreadPointsBar from "../../points/ThreadPointsBar";
import { gql, useLazyQuery, useMutation, useApolloClient } from "@apollo/client";
import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
import { useSelector } from "react-redux";
import { AppState } from "../../../store/AppState";
import { Node } from "slate";
import { getTextFromNodes } from "../../editor/RichEditor";
import Category from "../../../models/Category";
import ThreadPointsInline from "../../points/ThreadPointsInline";
import ThreadResponse from "./ThreadResponse";
import BackButton from "../../BackButton";
import { database } from "../../../db/Database";
import { isOnHomeWiFi } from "../../../utils/network";

export const GetThreadById = gql`
  query GetThreadById($id: ID!) {
    getThreadById(id: $id) {
      ... on EntityResult { messages }
      ... on Thread {
        id
        user { id userName }
        lastModifiedOn
        createdOn
        title
        body
        points
        category { id name }
        threadItems {
          id
          body
          aiResponse
          points
          createdOn
          thread { id }
          user { id userName }
        }
      }
    }
  }
`;

const CreateThread = gql`
  mutation createThread($userId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createThread(userId: $userId, categoryId: $categoryId, title: $title, body: $body) { messages }
  }
`;

const threadReducer = (state: any, action: any) => {
  switch (action.type) {
    case "userId": return { ...state, userId: action.payload };
    case "category": return { ...state, category: action.payload };
    case "title": return { ...state, title: action.payload };
    case "body": return { ...state, body: action.payload };
    case "bodyNode": return { ...state, bodyNode: action.payload };
    default: throw new Error("Unknown action type");
  }
};

const Thread = () => {
  const { width } = useWindowDimensions();
  
  // 1. useLazyQuery for initial load (React Router friendly)
  const [execGetThreadById, { data: threadData }] = useLazyQuery(GetThreadById, { fetchPolicy: "network-only" });
  
  // 2. useApolloClient for manual refresh (Bypasses Apollo cache bugs)
  const client = useApolloClient();
  
  const [thread, setThread] = useState<ThreadModel | undefined>();
  const { id } = useParams();
  const [readOnly, setReadOnly] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const user = useSelector((state: AppState) => state.user);
  
  const [{ userId, category, title, bodyNode }, threadReducerDispatch] = useReducer(threadReducer, {
    userId: user ? user.id : "0", category: undefined, title: "", body: "", bodyNode: undefined,
  });
  const [postMsg, setPostMsg] = useState("");
  const [execCreateThread] = useMutation(CreateThread);
  const navigate = useNavigate();

  // FIX: This function is called manually after a mutation. It uses client.query to force a network fetch.
  const refreshThread = async () => {
    if (!id) return;
    try {
      const response = await client.query({
        query: GetThreadById,
        variables: { id },
        fetchPolicy: 'network-only'
      });

      console.log("✅ Thread Refreshed. Total items:", response.data.getThreadById?.threadItems?.length);

      if (response.data && response.data.getThreadById) {
        const threadObj = response.data.getThreadById;
        
        // 1. Set state FIRST so UI paints immediately
        setThread(threadObj);
        setReadOnly(true);

        // 2. Defer SQLite saving to prevent UI freeze (Bulletproof fix)
        setTimeout(async () => {
          try {
            await database.saveThreads([threadObj]);
            if (threadObj.threadItems && threadObj.threadItems.length > 0) {
              const itemsToSave = threadObj.threadItems.map((item: any) => ({
                id: item.id.toString(),
                thread_id: threadObj.id.toString(),
                user_id: item.user?.id?.toString() || 'default',
                body: item.body || '',
                ai_response: { text: item.aiResponse || '' },
                tts_text: item.aiResponse || '', 
                created_at: item.createdOn || new Date().toISOString(), 
                is_synced: 1, 
              }));
              await database.saveThreadItems(itemsToSave);
            }
          } catch (e) {
            console.error("Background SQLite save error:", e);
          }
        }, 50); // 50ms delay allows React to paint the screen first
      }

      // if (response.data && response.data.getThreadById) {
      //   const threadObj = response.data.getThreadById;
      //   setThread(threadObj);
      //   setReadOnly(true);

      //   database.saveThreads([threadObj]).catch(console.error);
      //   if (threadObj.threadItems && threadObj.threadItems.length > 0) {
      //     const itemsToSave = threadObj.threadItems.map((item: any) => ({
      //       id: item.id.toString(), thread_id: threadObj.id.toString(),
      //       user_id: item.user?.id?.toString() || 'default', body: item.body || '',
      //       ai_response: { text: item.aiResponse || '' }, tts_text: item.aiResponse || '', 
      //       created_at: item.createdOn || new Date().toISOString(), is_synced: 1, 
      //     }));
      //     database.saveThreadItems(itemsToSave).catch(console.error);
      //   }
      // }
    } catch (error) {
      console.error("Error fetching thread:", error);
    }
  };

  useEffect(() => {
    const checkNetworkAndLoad = async () => {
      const online = await isOnHomeWiFi();
      setIsOnline(online);

      if (online && id) {
        // Initial load uses useLazyQuery
        execGetThreadById({ variables: { id } });
      } else if (!online && id) {
        const threadMeta = await database.getThreadById(id);
        const items = await database.getThreadItemsByThreadId(id);
        if (items && items.length > 0) {
          const threadData = {
            id: id, title: threadMeta?.title || "Cached Conversation", body: threadMeta?.body || "",
            points: threadMeta?.points || 0, user: { id: "0", userName: threadMeta?.user_name || "User" },
            // FIX 1: Changed "" to Date.now() in the fallback
            lastModifiedOn: new Date(threadMeta?.created_at || Date.now()), 
            category: { id: "0", name: "Offline" },
            threadItems: items.map(item => ({
              id: item.id, body: item.body || '', aiResponse: item.ai_response?.text || '', points: 0,
              thread: { id }, user: { id: "0", userName: "User" }, 
              // FIX 2: Changed '' to Date.now() in the fallback
              createdOn: new Date(item.created_at || Date.now()), 
            })),
          };
          
          // const threadData = {
          //   id: id, title: threadMeta?.title || "Cached Conversation", body: threadMeta?.body || "",
          //   points: threadMeta?.points || 0, user: { id: "0", userName: threadMeta?.user_name || "User" },
          //   lastModifiedOn: new Date(threadMeta?.created_at || ""), category: { id: "0", name: "Offline" },
          //   threadItems: items.map(item => ({
          //     id: item.id, body: item.body || '', aiResponse: item.ai_response?.text || '', points: 0,
          //     thread: { id }, user: { id: "0", userName: "User" }, createdOn: new Date(item.created_at || ''),
          //   })),
          // };
          setThread(threadData as any);
          setReadOnly(true);
        }
      }
    };
    checkNetworkAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // FIX: This useEffect listens for the initial useLazyQuery data
  useEffect(() => {
    if (threadData && threadData.getThreadById) {
      const threadObj = threadData.getThreadById;
      setThread(threadObj);
      setReadOnly(true);

      database.saveThreads([threadObj]).catch(console.error);
      if (threadObj.threadItems && threadObj.threadItems.length > 0) {
        const itemsToSave = threadObj.threadItems.map((item: any) => ({
          id: item.id.toString(), thread_id: threadObj.id.toString(),
          user_id: item.user?.id?.toString() || 'default', body: item.body || '',
          ai_response: { text: item.aiResponse || '' }, tts_text: item.aiResponse || '', 
          created_at: item.createdOn || new Date().toISOString(), is_synced: 1, 
        }));
        database.saveThreadItems(itemsToSave).catch(console.error);
      }
    } else if (threadData && !threadData.getThreadById) {
      setThread(undefined);
      setReadOnly(false);
    }
  }, [threadData]);

  useEffect(() => {
    threadReducerDispatch({ type: "userId", payload: user ? user.id : "0" });
  }, [user]);

  const receiveSelectedCategory = (cat: Category) => threadReducerDispatch({ type: "category", payload: cat });
  const receiveTitle = (updatedTitle: string) => threadReducerDispatch({ type: "title", payload: updatedTitle });
  const receiveBody = (body: Node[]) => {
    threadReducerDispatch({ type: "bodyNode", payload: body });
    threadReducerDispatch({ type: "body", payload: getTextFromNodes(body) });
  };

  const onClickPost = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (!userId || userId === "0") setPostMsg("You must be logged in before you can post.");
    else if (!category) setPostMsg("Please select a category for your post.");
    else if (!title) setPostMsg("Please enter a title.");
    else if (!bodyNode) setPostMsg("Please select a category for your post");
    else {
      setPostMsg("");
      const newThread = { userId, categoryId: category?.id, title, body: JSON.stringify(bodyNode) };
      const { data: createThreadMsg } = await execCreateThread({ variables: newThread });
      if (createThreadMsg.createThread && createThreadMsg.createThread.messages && !isNaN(createThreadMsg.createThread.messages[0])) {
        setPostMsg("Thread posted successfully.");
        navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
      } else {
        setPostMsg(createThreadMsg.createThread.messages[0]);
      }
    }
  };

  return (
    <div className="screen-root-container">
      <div className="thread-nav-container">
        <Nav />
        <div style={{ marginTop: ".2em" }} ><BackButton /></div>
      </div>
      <div className="thread-content-container">
        <div className="thread-content-post-container">
          {width <= 768 && thread ? (
            <ThreadPointsInline points={thread?.points || 0} threadId={thread?.id} refreshThread={refreshThread} allowUpdatePoints={true} />
          ) : null}
          <ThreadHeader userName={thread ? thread.user.userName : user?.userName} lastModifiedOn={thread ? thread.lastModifiedOn : new Date()} title={thread ? thread.title : title} />
          <ThreadCategory category={thread ? thread.category : category} sendOutSelectedCategory={receiveSelectedCategory} />
          <ThreadTitle title={thread ? thread.title : ""} readOnly={thread ? readOnly : false} sendOutTitle={receiveTitle} />
          <ThreadBody body={thread? thread.body : "" } readOnly={thread ? readOnly : false} sendOutBody={receiveBody} />
          {thread ? null : (
            <>
              <div style={{ marginTop: ".5em" }}><button className="action-btn" onClick={onClickPost}>Create</button></div>
              <strong>{postMsg}</strong>
            </>
          )}
        </div>
        <div className="thread-content-points-container">
          <ThreadPointsBar points={thread?.points || 0} responseCount={(thread && thread.threadItems && thread.threadItems.length) || 0} threadId={thread?.id || "0"} allowUpdatePoints={true} refreshThread={refreshThread} />
        </div>
      </div>
      {thread ? (
        <div className="thread-content-response-container">
          <hr className="thread-section-divider" />
          <div style={{ marginBottom: ".5em" }}><strong>Ask Aqua Questions</strong></div>
          <ThreadResponse body={""} userId={userId} userName={user?.userName} lastModifiedOn={new Date()} points={0} readOnly={false} threadItemId={"0"} threadId={thread.id} refreshThread={refreshThread} />
        </div>
      ) : null}
      {thread ? (
        <div className="thread-content-response-container">
          <hr className="thread-section-divider" />
          <ThreadResponsesBuilder threadItems={thread?.threadItems} readOnly={readOnly} refreshThread={refreshThread} />
        </div>
      ) : null}
    </div>
  );
};

export default Thread;

// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useApolloClient, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// export const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult { messages }
//       ... on Thread {
//         id
//         user { id userName }
//         lastModifiedOn
//         createdOn
//         title
//         body
//         points
//         category { id name }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           createdOn
//           thread { id }
//           user { id userName }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread($userId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
//     createThread(userId: $userId, categoryId: $categoryId, title: $title, body: $body) { messages }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId": return { ...state, userId: action.payload };
//     case "category": return { ...state, category: action.payload };
//     case "title": return { ...state, title: action.payload };
//     case "body": return { ...state, body: action.payload };
//     case "bodyNode": return { ...state, bodyNode: action.payload };
//     default: throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const client = useApolloClient(); // FIX: Use ApolloClient directly
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();
//   const [readOnly, setReadOnly] = useState(false);
//   const [isOnline, setIsOnline] = useState(true);
//   const user = useSelector((state: AppState) => state.user);
  
//   const [{ userId, category, title, bodyNode }, threadReducerDispatch] = useReducer(threadReducer, {
//     userId: user ? user.id : "0", category: undefined, title: "", body: "", bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   // FIX: This function explicitly fetches data and updates state, immune to Redux re-renders
//   const fetchThreadData = async () => {
//     if (!id) return;
//     try {
//       const response = await client.query({
//         query: GetThreadById,
//         variables: { id },
//         fetchPolicy: 'network-only' // Forces network fetch
//       });

//       // ADD THIS LOG: Let's see exactly what Apollo got from the Mini PC!
//       console.log("🔍 APOLLO FETCH RESULT:", response.data.getThreadById?.threadItems?.length, "items found.");
//       if (response.data.getThreadById?.threadItems) {
//         console.log("Latest Item ID:", response.data.getThreadById.threadItems[0].id);
//       }

//       if (response.data && response.data.getThreadById) {
//         const threadObj = response.data.getThreadById;
//         setThread(threadObj);
//         setReadOnly(true);

//         // Cache to SQLite
//         database.saveThreads([threadObj]).catch(console.error);
//         if (threadObj.threadItems && threadObj.threadItems.length > 0) {
//           const itemsToSave = threadObj.threadItems.map((item: any) => ({
//             id: item.id.toString(), thread_id: threadObj.id.toString(),
//             user_id: item.user?.id?.toString() || 'default', body: item.body || '',
//             ai_response: { text: item.aiResponse || '' }, tts_text: item.aiResponse || '', 
//             created_at: item.createdOn || new Date().toISOString(), is_synced: 1, 
//           }));
//           database.saveThreadItems(itemsToSave).catch(console.error);
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching thread:", error);
//     }
//   };

//   const refreshThread = () => {
//     fetchThreadData();
//   };

//   useEffect(() => {
//     const checkNetworkAndLoad = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (online && id) {
//         fetchThreadData(); // Initial load
//       } else if (!online && id) {
//         const threadMeta = await database.getThreadById(id);
//         const items = await database.getThreadItemsByThreadId(id);
//         if (items && items.length > 0) {
//           const threadData = {
//             id: id, title: threadMeta?.title || "Cached Conversation", body: threadMeta?.body || "",
//             points: threadMeta?.points || 0, user: { id: "0", userName: threadMeta?.user_name || "User" },
//             lastModifiedOn: new Date(threadMeta?.created_at || ""), category: { id: "0", name: "Offline" },
//             threadItems: items.map(item => ({
//               id: item.id, body: item.body || '', aiResponse: item.ai_response?.text || '', points: 0,
//               thread: { id }, user: { id: "0", userName: "User" }, createdOn: new Date(item.created_at || ''),
//             })),
//           };
//           setThread(threadData as any);
//           setReadOnly(true);
//         }
//       }
//     };
//     checkNetworkAndLoad();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id]);

//   useEffect(() => {
//     threadReducerDispatch({ type: "userId", payload: user ? user.id : "0" });
//   }, [user]);

//   const receiveSelectedCategory = (cat: Category) => threadReducerDispatch({ type: "category", payload: cat });
//   const receiveTitle = (updatedTitle: string) => threadReducerDispatch({ type: "title", payload: updatedTitle });
//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({ type: "bodyNode", payload: body });
//     threadReducerDispatch({ type: "body", payload: getTextFromNodes(body) });
//   };

//   const onClickPost = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
//     e.preventDefault();
//     if (!userId || userId === "0") setPostMsg("You must be logged in before you can post.");
//     else if (!category) setPostMsg("Please select a category for your post.");
//     else if (!title) setPostMsg("Please enter a title.");
//     else if (!bodyNode) setPostMsg("Please select a category for your post");
//     else {
//       setPostMsg("");
//       const newThread = { userId, categoryId: category?.id, title, body: JSON.stringify(bodyNode) };
//       const { data: createThreadMsg } = await execCreateThread({ variables: newThread });
//       if (createThreadMsg.createThread && createThreadMsg.createThread.messages && !isNaN(createThreadMsg.createThread.messages[0])) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} ><BackButton /></div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline points={thread?.points || 0} threadId={thread?.id} refreshThread={refreshThread} allowUpdatePoints={true} />
//           ) : null}
//           <ThreadHeader userName={thread ? thread.user.userName : user?.userName} lastModifiedOn={thread ? thread.lastModifiedOn : new Date()} title={thread ? thread.title : title} />
//           <ThreadCategory category={thread ? thread.category : category} sendOutSelectedCategory={receiveSelectedCategory} />
//           <ThreadTitle title={thread ? thread.title : ""} readOnly={thread ? readOnly : false} sendOutTitle={receiveTitle} />
//           <ThreadBody body={thread? thread.body : "" } readOnly={thread ? readOnly : false} sendOutBody={receiveBody} />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}><button className="action-btn" onClick={onClickPost}>Create</button></div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar points={thread?.points || 0} responseCount={(thread && thread.threadItems && thread.threadItems.length) || 0} threadId={thread?.id || "0"} allowUpdatePoints={true} refreshThread={refreshThread} />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}><strong>Ask Aqua Questions</strong></div>
//           <ThreadResponse body={""} userId={userId} userName={user?.userName} lastModifiedOn={new Date()} points={0} readOnly={false} threadItemId={"0"} threadId={thread.id} refreshThread={refreshThread} />
//         </div>
//       ) : null}
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder threadItems={thread?.threadItems} readOnly={readOnly} refreshThread={refreshThread} />
//         </div>
//       ) : null}
//     </div>
//   );
// };

// export default Thread;

// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useLazyQuery, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// export const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult {
//         messages
//       }
//       ... on Thread {
//         id
//         user { id userName }
//         lastModifiedOn
//         createdOn
//         title
//         body
//         points
//         category { id name }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           createdOn
//           thread { id }
//           user { id userName }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread($userId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
//     createThread(userId: $userId, categoryId: $categoryId, title: $title, body: $body) {
//       messages
//     }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId": return { ...state, userId: action.payload };
//     case "category": return { ...state, category: action.payload };
//     case "title": return { ...state, title: action.payload };
//     case "body": return { ...state, body: action.payload };
//     case "bodyNode": return { ...state, bodyNode: action.payload };
//     default: throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const [execGetThreadById, { data: threadData }] = useLazyQuery(GetThreadById, { fetchPolicy: "no-cache" });
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();
//   const [readOnly, setReadOnly] = useState(false);
//   const [isOnline, setIsOnline] = useState(true);
//   const user = useSelector((state: AppState) => state.user);
  
//   const [{ userId, category, title, bodyNode }, threadReducerDispatch] = useReducer(threadReducer, {
//     userId: user ? user.id : "0", category: undefined, title: "", body: "", bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   const refreshThread = () => {
//     if (id && id.length > 0) {
//       execGetThreadById({ variables: { id } });
//     }
//   };

//   useEffect(() => {
//     const checkOffline = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (online && id) {
//         execGetThreadById({ variables: { id } });
//       } else if (!online && id) {
//         const threadMeta = await database.getThreadById(id);
//         const items = await database.getThreadItemsByThreadId(id);
//         if (items && items.length > 0) {
//           const threadData = {
//             id: id, title: threadMeta?.title || "Cached Conversation", body: threadMeta?.body || "",
//             points: threadMeta?.points || 0, user: { id: "0", userName: threadMeta?.user_name || "User" },
//             lastModifiedOn: new Date(threadMeta?.created_at || ""), category: { id: "0", name: "Offline" },
//             threadItems: items.map(item => ({
//               id: item.id, body: item.body || '', aiResponse: item.ai_response?.text || '', points: 0,
//               thread: { id }, user: { id: "0", userName: "User" }, createdOn: new Date(item.created_at || ''),
//             })),
//           };
//           setThread(threadData as any);
//           setReadOnly(true);
//         }
//       }
//     };
//     checkOffline();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id]);

//   useEffect(() => {
//     threadReducerDispatch({ type: "userId", payload: user ? user.id : "0" });
//   }, [user]);

//   useEffect(() => {
//     if (threadData && threadData.getThreadById) {
//       const threadObj = threadData.getThreadById;
//       setThread(threadObj);
//       setReadOnly(true);

//       database.saveThreads([threadObj]).catch(console.error);
//       if (threadObj.threadItems && threadObj.threadItems.length > 0) {
//         const itemsToSave = threadObj.threadItems.map((item: any) => ({
//           id: item.id.toString(), thread_id: threadObj.id.toString(),
//           user_id: item.user?.id?.toString() || 'default', body: item.body || '',
//           ai_response: { text: item.aiResponse || '' }, tts_text: item.aiResponse || '', 
//           created_at: item.createdOn || new Date().toISOString(), is_synced: 1, 
//         }));
//         database.saveThreadItems(itemsToSave).catch(console.error);
//       }
//     } else {
//       setThread(undefined);
//       setReadOnly(false);
//     }
//   }, [threadData]);

//   const receiveSelectedCategory = (cat: Category) => threadReducerDispatch({ type: "category", payload: cat });
//   const receiveTitle = (updatedTitle: string) => threadReducerDispatch({ type: "title", payload: updatedTitle });
//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({ type: "bodyNode", payload: body });
//     threadReducerDispatch({ type: "body", payload: getTextFromNodes(body) });
//   };

//   const onClickPost = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
//     e.preventDefault();
//     if (!userId || userId === "0") setPostMsg("You must be logged in before you can post.");
//     else if (!category) setPostMsg("Please select a category for your post.");
//     else if (!title) setPostMsg("Please enter a title.");
//     else if (!bodyNode) setPostMsg("Please select a category for your post");
//     else {
//       setPostMsg("");
//       const newThread = { userId, categoryId: category?.id, title, body: JSON.stringify(bodyNode) };
//       const { data: createThreadMsg } = await execCreateThread({ variables: newThread });
//       if (createThreadMsg.createThread && createThreadMsg.createThread.messages && !isNaN(createThreadMsg.createThread.messages[0])) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} ><BackButton /></div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline points={thread?.points || 0} threadId={thread?.id} refreshThread={refreshThread} allowUpdatePoints={true} />
//           ) : null}
//           <ThreadHeader userName={thread ? thread.user.userName : user?.userName} lastModifiedOn={thread ? thread.lastModifiedOn : new Date()} title={thread ? thread.title : title} />
//           <ThreadCategory category={thread ? thread.category : category} sendOutSelectedCategory={receiveSelectedCategory} />
//           <ThreadTitle title={thread ? thread.title : ""} readOnly={thread ? readOnly : false} sendOutTitle={receiveTitle} />
//           <ThreadBody body={thread? thread.body : "" } readOnly={thread ? readOnly : false} sendOutBody={receiveBody} />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}><button className="action-btn" onClick={onClickPost}>Create</button></div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar points={thread?.points || 0} responseCount={(thread && thread.threadItems && thread.threadItems.length) || 0} threadId={thread?.id || "0"} allowUpdatePoints={true} refreshThread={refreshThread} />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}><strong>Ask Aqua Questions</strong></div>
//           <ThreadResponse body={""} userId={userId} userName={user?.userName} lastModifiedOn={new Date()} points={0} readOnly={false} threadItemId={"0"} threadId={thread.id} refreshThread={refreshThread} />
//         </div>
//       ) : null}
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder threadItems={thread?.threadItems} readOnly={readOnly} refreshThread={refreshThread} />
//         </div>
//       ) : null}
//     </div>
//   );
// };

// export default Thread;

// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useLazyQuery, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult {
//         messages
//       }

//       ... on Thread {
//         id
//         user {
//           id
//           userName
//         }
//         lastModifiedOn
//         title
//         body
//         points
//         category {
//           id
//           name
//         }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           createdOn
//           thread {
//             id
//           }
//           user {
//             id
//             userName
//           }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread(
//     $userId: ID!
//     $categoryId: ID!
//     $title: String!
//     $body: String!
//   ) {
//     createThread(
//       userId: $userId
//       categoryId: $categoryId
//       title: $title
//       body: $body
//     ) {
//       messages
//     }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId":
//       return { ...state, userId: action.payload };
//     case "category":
//       return { ...state, category: action.payload };
//     case "title":
//       return { ...state, title: action.payload };
//     case "body":
//       return { ...state, body: action.payload };
//     case "bodyNode":
//       return { ...state, bodyNode: action.payload };
//     default:
//       throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const [execGetThreadById, { data: threadData }] = useLazyQuery(GetThreadById, {
//     fetchPolicy: "network-only"
//   });
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();
//   const [readOnly, setReadOnly] = useState(false);
//   const [isOnline, setIsOnline] = useState(true);
//   const user = useSelector((state: AppState) => state.user);
  
//   // FIX: State counter to force re-fetch when refreshThread is called
//   const [refreshKey, setRefreshKey] = useState(0);

//   const [
//     { userId, category, title, bodyNode },
//     threadReducerDispatch,
//   ] = useReducer(threadReducer, {
//     userId: user ? user.id : "0",
//     category: undefined,
//     title: "",
//     body: "",
//     bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   // FIX: Increment counter to force the useEffect below to re-run the query
//   const refreshThread = () => {
//     setRefreshKey(prev => prev + 1);
//   };

//   useEffect(() => {
//     const checkOffline = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (online && id) {
//         // ONLINE: Fire Apollo query (this runs on mount AND when refreshKey changes)
//         execGetThreadById({ variables: { id } });
//       } else if (!online && id) {
//         // OFFLINE: Load from local DB
//         const threadMeta = await database.getThreadById(id);
//         const items = await database.getThreadItemsByThreadId(id);
//         if (items && items.length > 0) {
//           const threadData = {
//             id: id,
//             title: threadMeta?.title || "Cached Conversation",
//             body: threadMeta?.body || "",
//             points: threadMeta?.points || 0,
//             user: { id: "0", userName: threadMeta?.user_name || "User" },
//             lastModifiedOn: new Date(threadMeta?.created_at || ""),
//             category: { id: "0", name: "Offline" },
//             threadItems: items.map(item => ({
//               id: item.id,
//               body: item.body || '',
//               aiResponse: item.ai_response?.text || '',
//               points: 0,
//               thread: { id },
//               user: { id: "0", userName: "User" },
//               createdOn: new Date(item.created_at || ''),
//             })),
//           };
//           setThread(threadData as any);
//           setReadOnly(true);
//         }
//       }
//     };
//     checkOffline();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id, refreshKey]); // <-- refreshKey is a dependency

//   useEffect(() => {
//     threadReducerDispatch({
//       type: "userId",
//       payload: user ? user.id : "0",
//     });
//   }, [user]);

//   useEffect(() => {
//     if (threadData && threadData.getThreadById) {
//       const threadObj = threadData.getThreadById;
//       setThread(threadObj);
//       setReadOnly(true);

//       // Cache the Thread metadata so it appears on the Main page offline!
//       database.saveThreads([threadObj]).catch(console.error);

//       // Cache the thread items to SQLite!
//       if (threadObj.threadItems && threadObj.threadItems.length > 0) {
//         const itemsToSave = threadObj.threadItems.map((item: any) => ({
//           id: item.id.toString(),
//           thread_id: threadObj.id.toString(),
//           user_id: item.user?.id?.toString() || 'default',
//           body: item.body || '',
//           ai_response: { text: item.aiResponse || '' },
//           tts_text: item.aiResponse || '', 
//           created_at: item.createdOn || new Date().toISOString(), 
//           is_synced: 1, 
//         }));
//         database.saveThreadItems(itemsToSave).catch(console.error);
//       }
//     } else {
//       setThread(undefined);
//       setReadOnly(false);
//     }
//   }, [threadData]);

//   const receiveSelectedCategory = (cat: Category) => {
//     threadReducerDispatch({
//       type: "category",
//       payload: cat,
//     });
//   };

//   const receiveTitle = (updatedTitle: string) => {
//     threadReducerDispatch({
//       type: "title",
//       payload: updatedTitle,
//     });
//   };

//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({
//       type: "bodyNode",
//       payload: body,
//     });
//     threadReducerDispatch({
//       type: "body",
//       payload: getTextFromNodes(body),
//     });
//   };

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     console.log("bodyNode", getTextFromNodes(bodyNode));
//     if (!userId || userId === "0") {
//       setPostMsg("You must be logged in before you can post.");
//     } else if (!category) {
//       setPostMsg("Please select a category for your post.");
//     } else if (!title) {
//       setPostMsg("Please enter a title.");
//     } else if (!bodyNode) {
//       setPostMsg("Please select a category for your post");
//     } else {
//       setPostMsg("");
//       const newThread = {
//         userId,
//         categoryId: category?.id,
//         title,
//         body: JSON.stringify(bodyNode),
//       };
//       console.log("newThread", newThread);
//       const { data: createThreadMsg } = await execCreateThread({
//         variables: newThread,
//       });
//       console.log("createThreadMsg", createThreadMsg);
//       if (
//         createThreadMsg.createThread &&
//         createThreadMsg.createThread.messages &&
//         !isNaN(createThreadMsg.createThread.messages[0])
//       ) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} >
//           <BackButton />
//         </div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline
//               points={thread?.points || 0}
//               threadId={thread?.id}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           ) : null}

//           <ThreadHeader
//             userName={thread ? thread.user.userName : user?.userName}
//             lastModifiedOn={thread ? thread.lastModifiedOn : new Date()}
//             title={thread ? thread.title : title}
//           />
//           <ThreadCategory
//             category={thread ? thread.category : category}
//             sendOutSelectedCategory={receiveSelectedCategory}
//           />
//           <ThreadTitle
//             title={thread ? thread.title : ""}
//             readOnly={thread ? readOnly : false}
//             sendOutTitle={receiveTitle}
//           />
//           <ThreadBody
//             body={thread? thread.body : "" }
//             readOnly={thread ? readOnly : false}
//             sendOutBody={receiveBody}
//           />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}>
//                 <button className="action-btn" onClick={onClickPost}>
//                   Create
//                 </button>
//               </div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar
//             points={thread?.points || 0}
//             responseCount={
//               (thread && thread.threadItems && thread.threadItems.length) || 0
//             }
//             threadId={thread?.id || "0"}
//             allowUpdatePoints={true}
//             refreshThread={refreshThread}
//           />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}>
//             <strong>Ask Aqua Questions</strong>
//           </div>
//           <ThreadResponse
//             body={""}
//             userId={userId}
//             userName={user?.userName}
//             lastModifiedOn={new Date()}
//             points={0}
//             readOnly={false}
//             threadItemId={"0"}
//             threadId={thread.id}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder
//             threadItems={thread?.threadItems}
//             readOnly={readOnly}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//     </div>
//   );
// };

// export default Thread;

// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useQuery, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult {
//         messages
//       }

//       ... on Thread {
//         id
//         user {
//           id
//           userName
//         }
//         lastModifiedOn
//         createdOn
//         title
//         body
//         points
//         category {
//           id
//           name
//         }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           createdOn
//           thread {
//             id
//           }
//           user {
//             id
//             userName
//           }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread(
//     $userId: ID!
//     $categoryId: ID!
//     $title: String!
//     $body: String!
//   ) {
//     createThread(
//       userId: $userId
//       categoryId: $categoryId
//       title: $title
//       body: $body
//     ) {
//       messages
//     }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId":
//       return { ...state, userId: action.payload };
//     case "category":
//       return { ...state, category: action.payload };
//     case "title":
//       return { ...state, title: action.payload };
//     case "body":
//       return { ...state, body: action.payload };
//     case "bodyNode":
//       return { ...state, bodyNode: action.payload };
//     default:
//       throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const { id } = useParams();
//   const [isOnline, setIsOnline] = useState(true);
  
//   // FIX: Use useQuery with refetch instead of useLazyQuery
//   const { data: threadData, refetch } = useQuery(GetThreadById, {
//     variables: { id },
//     fetchPolicy: "network-only",
//     skip: !id // Don't run query if we don't have an ID (e.g., creating a new thread)
//   });

//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const [readOnly, setReadOnly] = useState(false);
//   const user = useSelector((state: AppState) => state.user);
//   const [
//     { userId, category, title, bodyNode },
//     threadReducerDispatch,
//   ] = useReducer(threadReducer, {
//     userId: user ? user.id : "0",
//     category: undefined,
//     title: "",
//     body: "",
//     bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   // FIX: Use refetch to force Apollo to update the UI instantly
//   const refreshThread = () => {
//     if (id && isOnline) {
//       refetch();
//     }
//   };

//   useEffect(() => {
//     const checkOffline = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (!online && id) {
//         // OFFLINE: Load from local DB
//         const threadMeta = await database.getThreadById(id);
//         const items = await database.getThreadItemsByThreadId(id);
//         if (items && items.length > 0) {
//           const threadData = {
//             id: id,
//             title: threadMeta?.title || "Cached Conversation",
//             body: threadMeta?.body || "",
//             points: threadMeta?.points || 0,
//             user: { id: "0", userName: threadMeta?.user_name || "User" },
//             lastModifiedOn: new Date(threadMeta?.created_at || ""),
//             category: { id: "0", name: "Offline" },
//             threadItems: items.map(item => ({
//               id: item.id,
//               body: item.body || '',
//               aiResponse: item.ai_response?.text || '',
//               points: 0,
//               thread: { id },
//               user: { id: "0", userName: "User" },
//               createdOn: new Date(item.created_at || ''),
//             })),
//           };
//           setThread(threadData as any);
//           setReadOnly(true);
//         }
//       }
//       // If online, useQuery automatically fetches the data!
//     };
//     checkOffline();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id]);

//   useEffect(() => {
//     threadReducerDispatch({
//       type: "userId",
//       payload: user ? user.id : "0",
//     });
//   }, [user]);

//   useEffect(() => {
//     if (threadData && threadData.getThreadById) {
//       const threadObj = threadData.getThreadById;
//       setThread(threadObj);
//       setReadOnly(true);

//       // FIX: Cache the Thread metadata so it appears on the Main page offline!
//       database.saveThreads([threadObj]).catch(console.error);

//       // Cache the thread items to SQLite!
//       if (threadObj.threadItems && threadObj.threadItems.length > 0) {
//         const itemsToSave = threadObj.threadItems.map((item: any) => ({
//           id: item.id.toString(),
//           thread_id: threadObj.id.toString(),
//           user_id: item.user?.id?.toString() || 'default',
//           body: item.body || '',
//           ai_response: { text: item.aiResponse || '' },
//           tts_text: item.aiResponse || '', 
//           created_at: item.createdOn || new Date().toISOString(), 
//           is_synced: 1, 
//         }));
//         database.saveThreadItems(itemsToSave).catch(console.error);
//       }
//     } else {
//       setThread(undefined);
//       setReadOnly(false);
//     }
//   }, [threadData]);

//   const receiveSelectedCategory = (cat: Category) => {
//     threadReducerDispatch({
//       type: "category",
//       payload: cat,
//     });
//   };

//   const receiveTitle = (updatedTitle: string) => {
//     threadReducerDispatch({
//       type: "title",
//       payload: updatedTitle,
//     });
//   };

//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({
//       type: "bodyNode",
//       payload: body,
//     });
//     threadReducerDispatch({
//       type: "body",
//       payload: getTextFromNodes(body),
//     });
//   };

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     console.log("bodyNode", getTextFromNodes(bodyNode));
//     if (!userId || userId === "0") {
//       setPostMsg("You must be logged in before you can post.");
//     } else if (!category) {
//       setPostMsg("Please select a category for your post.");
//     } else if (!title) {
//       setPostMsg("Please enter a title.");
//     } else if (!bodyNode) {
//       setPostMsg("Please select a category for your post");
//     } else {
//       setPostMsg("");
//       const newThread = {
//         userId,
//         categoryId: category?.id,
//         title,
//         body: JSON.stringify(bodyNode),
//       };
//       console.log("newThread", newThread);
//       const { data: createThreadMsg } = await execCreateThread({
//         variables: newThread,
//       });
//       console.log("createThreadMsg", createThreadMsg);
//       if (
//         createThreadMsg.createThread &&
//         createThreadMsg.createThread.messages &&
//         !isNaN(createThreadMsg.createThread.messages[0])
//       ) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} >
//           <BackButton />
//         </div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline
//               points={thread?.points || 0}
//               threadId={thread?.id}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           ) : null}

//           <ThreadHeader
//             userName={thread ? thread.user.userName : user?.userName}
//             lastModifiedOn={thread ? thread.lastModifiedOn : new Date()}
//             title={thread ? thread.title : title}
//           />
//           <ThreadCategory
//             category={thread ? thread.category : category}
//             sendOutSelectedCategory={receiveSelectedCategory}
//           />
//           <ThreadTitle
//             title={thread ? thread.title : ""}
//             readOnly={thread ? readOnly : false}
//             sendOutTitle={receiveTitle}
//           />
//           <ThreadBody
//             body={thread? thread.body : "" }
//             readOnly={thread ? readOnly : false}
//             sendOutBody={receiveBody}
//           />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}>
//                 <button className="action-btn" onClick={onClickPost}>
//                   Create
//                 </button>
//               </div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar
//             points={thread?.points || 0}
//             responseCount={
//               (thread && thread.threadItems && thread.threadItems.length) || 0
//             }
//             threadId={thread?.id || "0"}
//             allowUpdatePoints={true}
//             refreshThread={refreshThread}
//           />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}>
//             <strong>Ask Aqua Questions</strong>
//           </div>
//           <ThreadResponse
//             body={""}
//             userId={userId}
//             userName={user?.userName}
//             lastModifiedOn={new Date()}
//             points={0}
//             readOnly={false}
//             threadItemId={"0"}
//             threadId={thread.id}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder
//             threadItems={thread?.threadItems}
//             readOnly={readOnly}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//     </div>
//   );
// };

// export default Thread;

// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useLazyQuery, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult {
//         messages
//       }

//       ... on Thread {
//         id
//         user {
//           id
//           userName
//         }
//         lastModifiedOn
//         title
//         body
//         points
//         category {
//           id
//           name
//         }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           thread {
//             id
//           }
//           user {
//             id
//             userName
//           }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread(
//     $userId: ID!
//     $categoryId: ID!
//     $title: String!
//     $body: String!
//   ) {
//     createThread(
//       userId: $userId
//       categoryId: $categoryId
//       title: $title
//       body: $body
//     ) {
//       messages
//     }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId":
//       return { ...state, userId: action.payload };
//     case "category":
//       return { ...state, category: action.payload };
//     case "title":
//       return { ...state, title: action.payload };
//     case "body":
//       return { ...state, body: action.payload };
//     case "bodyNode":
//       return { ...state, bodyNode: action.payload };
//     default:
//       throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const [execGetThreadById, { data: threadData }] = useLazyQuery(
//     GetThreadById,
//     { fetchPolicy: "network-only" } // <-- CHANGE THIS FROM "no-cache" TO "network-only"
//     // { fetchPolicy: "no-cache" }
//   );
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();
//   const [readOnly, setReadOnly] = useState(false);
//   const [isOnline, setIsOnline] = useState(true);
//   const user = useSelector((state: AppState) => state.user);
//   const [
//     { userId, category, title, bodyNode },
//     threadReducerDispatch,
//   ] = useReducer(threadReducer, {
//     userId: user ? user.id : "0",
//     category: undefined,
//     title: "",
//     body: "",
//     bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   const refreshThread = () => {
//     if (id && id.length > 0) {
//       execGetThreadById({
//         variables: {
//           id,
//         },
//       });
//     }
//   };

//   useEffect(() => {
//     const checkOffline = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (!online && id) {
//         // OFFLINE: Load from local DB
//         const threadMeta = await database.getThreadById(id);
//         const items = await database.getThreadItemsByThreadId(id);
//         if (items && items.length > 0) {
//           const threadData = {
//             id: id,
//             title: threadMeta?.title || "Cached Conversation",
//             body: threadMeta?.body || "",
//             points: threadMeta?.points || 0,
//             user: { id: "0", userName: threadMeta?.user_name || "User" },
//             lastModifiedOn: new Date(threadMeta?.created_at || ""),
//             category: { id: "0", name: "Offline" },
//             threadItems: items.map(item => ({
//               id: item.id,
//               body: item.body || '',
//               aiResponse: item.ai_response?.text || '',
//               points: 0,
//               thread: { id },
//               user: { id: "0", userName: "User" },
//               createdOn: new Date(item.created_at || ''),
//             })),
//           };
//           setThread(threadData as any);
//           setReadOnly(true);
//         }
//       } else if (online && id) {
//         // ONLINE: Use existing GraphQL logic
//         execGetThreadById({ variables: { id } });
//       }
//     };
//     checkOffline();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id]);

//   useEffect(() => {
//     threadReducerDispatch({
//       type: "userId",
//       payload: user ? user.id : "0",
//     });
//   }, [user]);

//   useEffect(() => {
//     if (threadData && threadData.getThreadById) {
//       const threadObj = threadData.getThreadById;
//       setThread(threadObj);
//       setReadOnly(true);

//       // Cache the Thread metadata so it appears on the Main page offline!
//       database.saveThreads([threadObj]).catch(console.error);

//       // Cache the thread items to SQLite!
//       if (threadObj.threadItems && threadObj.threadItems.length > 0) {
//         const itemsToSave = threadObj.threadItems.map((item: any) => ({
//           id: item.id.toString(),
//           thread_id: threadObj.id.toString(),
//           user_id: item.user?.id?.toString() || 'default',
//           body: item.body || '',
//           ai_response: { text: item.aiResponse || '' },
//           tts_text: item.aiResponse || '', 
//           // FIX: Use the actual creation date instead of new Date() so sorting works!
//           created_at: item.createdOn || new Date().toISOString(), 
//           is_synced: 1, 
//         }));
//         database.saveThreadItems(itemsToSave).catch(console.error);
//       }
//     } else {
//       setThread(undefined);
//       setReadOnly(false);
//     }
//   }, [threadData]);

//   // useEffect(() => {
//   //   if (threadData && threadData.getThreadById) {
//   //     const threadObj = threadData.getThreadById;
//   //     setThread(threadObj);
//   //     setReadOnly(true);

//   //     // FIX: Cache the thread items to SQLite!
//   //     if (threadObj.threadItems && threadObj.threadItems.length > 0) {
//   //       const itemsToSave = threadObj.threadItems.map((item: any) => ({
//   //         id: item.id.toString(),
//   //         thread_id: threadObj.id.toString(),
//   //         user_id: item.user?.id?.toString() || 'default',
//   //         body: item.body || '',
//   //         ai_response: { text: item.aiResponse || '' },
//   //         tts_text: item.aiResponse || '', // Use aiResponse for TTS fallback
//   //         created_at: new Date().toISOString(), 
//   //         is_synced: 1, // Already in Mini PC
//   //       }));
//   //       database.saveThreadItems(itemsToSave);
//   //     }
//   //   } else {
//   //     setThread(undefined);
//   //     setReadOnly(false);
//   //   }
//   // }, [threadData]);

//   const receiveSelectedCategory = (cat: Category) => {
//     threadReducerDispatch({
//       type: "category",
//       payload: cat,
//     });
//   };

//   const receiveTitle = (updatedTitle: string) => {
//     threadReducerDispatch({
//       type: "title",
//       payload: updatedTitle,
//     });
//   };

//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({
//       type: "bodyNode",
//       payload: body,
//     });
//     threadReducerDispatch({
//       type: "body",
//       payload: getTextFromNodes(body),
//     });
//   };

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     console.log("bodyNode", getTextFromNodes(bodyNode));
//     // gather updated data
//     if (!userId || userId === "0") {
//       setPostMsg("You must be logged in before you can post.");
//     } else if (!category) {
//       setPostMsg("Please select a category for your post.");
//     } else if (!title) {
//       setPostMsg("Please enter a title.");
//     } else if (!bodyNode) {
//       setPostMsg("Please select a category for your post");
//     } else {
//       setPostMsg("");
//       const newThread = {
//         userId,
//         categoryId: category?.id,
//         title,
//         body: JSON.stringify(bodyNode),
//       };
//       console.log("newThread", newThread);
//       // send to server to save
//       const { data: createThreadMsg } = await execCreateThread({
//         variables: newThread,
//       });
//       console.log("createThreadMsg", createThreadMsg);
//       if (
//         createThreadMsg.createThread &&
//         createThreadMsg.createThread.messages &&
//         !isNaN(createThreadMsg.createThread.messages[0])
//       ) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} >
//           <BackButton />
//         </div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline
//               points={thread?.points || 0}
//               threadId={thread?.id}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           ) : null}

//           <ThreadHeader
//             userName={thread ? thread.user.userName : user?.userName}
//             lastModifiedOn={thread ? thread.lastModifiedOn : new Date()}
//             title={thread ? thread.title : title}
//           />
//           <ThreadCategory
//             category={thread ? thread.category : category}
//             sendOutSelectedCategory={receiveSelectedCategory}
//           />
//           <ThreadTitle
//             title={thread ? thread.title : ""}
//             readOnly={thread ? readOnly : false}
//             sendOutTitle={receiveTitle}
//           />
//           <ThreadBody
//             body={thread? thread.body : "" }
//             readOnly={thread ? readOnly : false}
//             sendOutBody={receiveBody}
//           />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}>
//                 <button className="action-btn" onClick={onClickPost}>
//                   Create
//                 </button>
//               </div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar
//             points={thread?.points || 0}
//             responseCount={
//               (thread && thread.threadItems && thread.threadItems.length) || 0
//             }
//             threadId={thread?.id || "0"}
//             allowUpdatePoints={true}
//             refreshThread={refreshThread}
//           />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}>
//             <strong>Ask Aqua Questions</strong>
//           </div>
//           <ThreadResponse
//             body={""}
//             userId={userId}
//             userName={user?.userName}
//             lastModifiedOn={new Date()}
//             points={0}
//             readOnly={false}
//             threadItemId={"0"}
//             threadId={thread.id}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder
//             threadItems={thread?.threadItems}
//             readOnly={readOnly}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//     </div>
//   );
// };

// export default Thread;

// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useLazyQuery, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";
// import { database } from "../../../db/Database";
// import { isOnHomeWiFi } from "../../../utils/network";

// const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult {
//         messages
//       }

//       ... on Thread {
//         id
//         user {
//           id
//           userName
//         }
//         lastModifiedOn
//         title
//         body
//         points
//         category {
//           id
//           name
//         }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           thread {
//             id
//           }
//           user {
//             id
//             userName
//           }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread(
//     $userId: ID!
//     $categoryId: ID!
//     $title: String!
//     $body: String!
//   ) {
//     createThread(
//       userId: $userId
//       categoryId: $categoryId
//       title: $title
//       body: $body
//     ) {
//       messages
//     }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId":
//       return { ...state, userId: action.payload };
//     case "category":
//       return { ...state, category: action.payload };
//     case "title":
//       return { ...state, title: action.payload };
//     case "body":
//       return { ...state, body: action.payload };
//     case "bodyNode":
//       return { ...state, bodyNode: action.payload };
//     default:
//       throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const [execGetThreadById, { data: threadData }] = useLazyQuery(
//     GetThreadById,
//     { fetchPolicy: "no-cache" }
//   );
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();
//   const [readOnly, setReadOnly] = useState(false);
//   const [isOnline, setIsOnline] = useState(true);
//   const user = useSelector((state: AppState) => state.user);
//   const [
//     { userId, category, title, bodyNode },
//     threadReducerDispatch,
//   ] = useReducer(threadReducer, {
//     userId: user ? user.id : "0",
//     category: undefined,
//     title: "",
//     body: "",
//     bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   const refreshThread = () => {
//     if (id && id.length > 0) {
//       execGetThreadById({
//         variables: {
//           id,
//         },
//       });
//     }
//   };

//   useEffect(() => {
//     const checkOffline = async () => {
//       const online = await isOnHomeWiFi();
//       setIsOnline(online);

//       if (!online && id) {
//         // OFFLINE: Load from local DB
//         const threadMeta = await database.getThreadById(id);
//         const items = await database.getThreadItemsByThreadId(id);
//         if (items && items.length > 0) {
//           const threadData = {
//             id: id,
//             title: threadMeta?.title || "Cached Conversation",
//             body: threadMeta?.body || "",
//             points: threadMeta?.points || 0,
//             user: { id: "0", userName: threadMeta?.user_name || "User" },
//             lastModifiedOn: new Date(threadMeta?.created_at || ""),
//             category: { id: "0", name: "Offline" },
//             threadItems: items.map(item => ({
//               id: item.id,
//               body: item.body || '',
//               aiResponse: item.ai_response?.text || '',
//               points: 0,
//               thread: { id },
//               user: { id: "0", userName: "User" },
//               createdOn: new Date(item.created_at || ''),
//             })),
//           };
//           setThread(threadData as any);
//           setReadOnly(true);
//         }
//       } else if (online && id) {
//         // ONLINE: Use existing GraphQL logic
//         execGetThreadById({ variables: { id } });
//       }
//     };
//     checkOffline();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id]);

//   useEffect(() => {
//     threadReducerDispatch({
//       type: "userId",
//       payload: user ? user.id : "0",
//     });
//   }, [user]);

//   useEffect(() => {
//     if (threadData && threadData.getThreadById) {
//       setThread(threadData.getThreadById);
//       setReadOnly(true);
//     } else {
//       setThread(undefined);
//       setReadOnly(false);
//     }
//   }, [threadData]);

//   const receiveSelectedCategory = (cat: Category) => {
//     threadReducerDispatch({
//       type: "category",
//       payload: cat,
//     });
//   };

//   const receiveTitle = (updatedTitle: string) => {
//     threadReducerDispatch({
//       type: "title",
//       payload: updatedTitle,
//     });
//   };

//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({
//       type: "bodyNode",
//       payload: body,
//     });
//     threadReducerDispatch({
//       type: "body",
//       payload: getTextFromNodes(body),
//     });
//   };

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     console.log("bodyNode", getTextFromNodes(bodyNode));
//     // gather updated data
//     if (!userId || userId === "0") {
//       setPostMsg("You must be logged in before you can post.");
//     } else if (!category) {
//       setPostMsg("Please select a category for your post.");
//     } else if (!title) {
//       setPostMsg("Please enter a title.");
//     } else if (!bodyNode) {
//       setPostMsg("Please select a category for your post");
//     } else {
//       setPostMsg("");
//       const newThread = {
//         userId,
//         categoryId: category?.id,
//         title,
//         body: JSON.stringify(bodyNode),
//       };
//       console.log("newThread", newThread);
//       // send to server to save
//       const { data: createThreadMsg } = await execCreateThread({
//         variables: newThread,
//       });
//       console.log("createThreadMsg", createThreadMsg);
//       if (
//         createThreadMsg.createThread &&
//         createThreadMsg.createThread.messages &&
//         !isNaN(createThreadMsg.createThread.messages[0])
//       ) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} >
//           <BackButton />
//         </div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline
//               points={thread?.points || 0}
//               threadId={thread?.id}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           ) : null}

//           <ThreadHeader
//             userName={thread ? thread.user.userName : user?.userName}
//             lastModifiedOn={thread ? thread.lastModifiedOn : new Date()}
//             title={thread ? thread.title : title}
//           />
//           <ThreadCategory
//             category={thread ? thread.category : category}
//             sendOutSelectedCategory={receiveSelectedCategory}
//           />
//           <ThreadTitle
//             title={thread ? thread.title : ""}
//             readOnly={thread ? readOnly : false}
//             sendOutTitle={receiveTitle}
//           />
//           <ThreadBody
//             body={thread? thread.body : "" }
//             readOnly={thread ? readOnly : false}
//             sendOutBody={receiveBody}
//           />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}>
//                 <button className="action-btn" onClick={onClickPost}>
//                   Create
//                 </button>
//               </div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar
//             points={thread?.points || 0}
//             responseCount={
//               (thread && thread.threadItems && thread.threadItems.length) || 0
//             }
//             threadId={thread?.id || "0"}
//             allowUpdatePoints={true}
//             refreshThread={refreshThread}
//           />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}>
//             <strong>Ask Aqua Questions</strong>
//           </div>
//           <ThreadResponse
//             body={""}
//             userId={userId}
//             userName={user?.userName}
//             lastModifiedOn={new Date()}
//             points={0}
//             readOnly={false}
//             threadItemId={"0"}
//             threadId={thread.id}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder
//             threadItems={thread?.threadItems}
//             readOnly={readOnly}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//     </div>
//   );
// };

// export default Thread;

// // import React, { useEffect, useState } from "react";
// import React, { useEffect, useReducer, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Thread.css";
// import ThreadHeader from "./ThreadHeader";
// import ThreadCategory from "./ThreadCategory";
// import ThreadTitle from "./ThreadTitle";
// import ThreadModel from "../../../models/Thread";
// // import { getThreadById } from "../../../services/DataService";
// import Nav from "../../areas/Nav";
// import ThreadBody from "./ThreadBody";
// import ThreadResponsesBuilder from "./ThreadResponsesBuilder";
// import ThreadPointsBar from "../../points/ThreadPointsBar";
// import { gql, useLazyQuery, useMutation } from "@apollo/client";
// import { useWindowDimensions } from "../../../hooks/useWindowDimensions";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { Node } from "slate";
// import { getTextFromNodes } from "../../editor/RichEditor";
// import Category from "../../../models/Category";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import ThreadResponse from "./ThreadResponse";
// import BackButton from "../../BackButton";


// const GetThreadById = gql`
//   query GetThreadById($id: ID!) {
//     getThreadById(id: $id) {
//       ... on EntityResult {
//         messages
//       }

//       ... on Thread {
//         id
//         user {
//           id
//           userName
//         }
//         lastModifiedOn
//         title
//         body
//         points
//         category {
//           id
//           name
//         }
//         threadItems {
//           id
//           body
//           aiResponse
//           points
//           thread {
//             id
//           }
//           user {
//             id
//             userName
//           }
//         }
//       }
//     }
//   }
// `;

// const CreateThread = gql`
//   mutation createThread(
//     $userId: ID!
//     $categoryId: ID!
//     $title: String!
//     $body: String!
//   ) {
//     createThread(
//       userId: $userId
//       categoryId: $categoryId
//       title: $title
//       body: $body
//     ) {
//       messages
//     }
//   }
// `;

// const threadReducer = (state: any, action: any) => {
//   switch (action.type) {
//     case "userId":
//       return { ...state, userId: action.payload };
//     case "category":
//       return { ...state, category: action.payload };
//     case "title":
//       return { ...state, title: action.payload };
//     case "body":
//       return { ...state, body: action.payload };
//     case "bodyNode":
//       return { ...state, bodyNode: action.payload };
//     default:
//       throw new Error("Unknown action type");
//   }
// };

// const Thread = () => {
//   const { width } = useWindowDimensions();
//   const [execGetThreadById, { data: threadData }] = useLazyQuery(
//     GetThreadById,
//     { fetchPolicy: "no-cache" }
//   );
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();
//   const [readOnly, setReadOnly] = useState(false);
//   const user = useSelector((state: AppState) => state.user);
//   const [
//     { userId, category, title, bodyNode },
//     threadReducerDispatch,
//   ] = useReducer(threadReducer, {
//     userId: user ? user.id : "0",
//     category: undefined,
//     title: "",
//     body: "",
//     bodyNode: undefined,
//   });
//   const [postMsg, setPostMsg] = useState("");
//   const [execCreateThread] = useMutation(CreateThread);
//   const navigate = useNavigate();

//   const refreshThread = () => {
//     if (id && id.length > 0) {
//       execGetThreadById({
//         variables: {
//           id,
//         },
//       });
//     }
//   };

//   useEffect(() => {
//     if (id && id.length > 0) {
//       execGetThreadById({
//         variables: {
//           id,
//         },
//       });
//     }
//   }, [id, execGetThreadById]);

//   useEffect(() => {
//     threadReducerDispatch({
//       type: "userId",
//       payload: user ? user.id : "0",
//     });
//   }, [user]);

//   useEffect(() => {
//     if (threadData && threadData.getThreadById) {
//       setThread(threadData.getThreadById);
//       setReadOnly(true);
//     } else {
//       setThread(undefined);
//       setReadOnly(false);
//     }
//   }, [threadData]);

//   const receiveSelectedCategory = (cat: Category) => {
//     threadReducerDispatch({
//       type: "category",
//       payload: cat,
//     });
//   };

//   const receiveTitle = (updatedTitle: string) => {
//     threadReducerDispatch({
//       type: "title",
//       payload: updatedTitle,
//     });
//   };

//   const receiveBody = (body: Node[]) => {
//     threadReducerDispatch({
//       type: "bodyNode",
//       payload: body,
//     });
//     threadReducerDispatch({
//       type: "body",
//       payload: getTextFromNodes(body),
//     });
//   };

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     console.log("bodyNode", getTextFromNodes(bodyNode));
//     // gather updated data
//     if (!userId || userId === "0") {
//       setPostMsg("You must be logged in before you can post.");
//     } else if (!category) {
//       setPostMsg("Please select a category for your post.");
//     } else if (!title) {
//       setPostMsg("Please enter a title.");
//     } else if (!bodyNode) {
//       setPostMsg("Please select a category for your post");
//     } else {
//       setPostMsg("");
//       const newThread = {
//         userId,
//         categoryId: category?.id,
//         title,
//         body: JSON.stringify(bodyNode),
//       };
//       console.log("newThread", newThread);
//       // send to server to save
//       const { data: createThreadMsg } = await execCreateThread({
//         variables: newThread,
//       });
//       console.log("createThreadMsg", createThreadMsg);
//       if (
//         createThreadMsg.createThread &&
//         createThreadMsg.createThread.messages &&
//         !isNaN(createThreadMsg.createThread.messages[0])
//       ) {
//         setPostMsg("Thread posted successfully.");
//         navigate(`/thread/${createThreadMsg.createThread.messages[0]}`);
//       } else {
//         setPostMsg(createThreadMsg.createThread.messages[0]);
//       }
//     }
//   };

// const Thread = () => {
//   const [thread, setThread] = useState<ThreadModel | undefined>();
//   const { id } = useParams();

//   useEffect(() => {
//     console.log("Thread id", id);
//     if (id && id.length > 0) {
//       getThreadById(id).then((th) => {
//         setThread(th);
//       });
//     }
//   }, [id]);

//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//         <div style={{ marginTop: ".2em" }} >
//            <BackButton />
//         </div>
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           {width <= 768 && thread ? (
//             <ThreadPointsInline
//               points={thread?.points || 0}
//               threadId={thread?.id}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           ) : null}

//           <ThreadHeader
//             userName={thread ? thread.user.userName : user?.userName}
//             lastModifiedOn={thread ? thread.lastModifiedOn : new Date()}
//             title={thread ? thread.title : title}
//           />
//           <ThreadCategory
//             category={thread ? thread.category : category}
//             sendOutSelectedCategory={receiveSelectedCategory}
//           />
//           <ThreadTitle
//             title={thread ? thread.title : ""}
//             readOnly={thread ? readOnly : false}
//             sendOutTitle={receiveTitle}
//           />
//           <ThreadBody
//             body={thread? thread.body : "" }
//             readOnly={thread ? readOnly : false}
//             sendOutBody={receiveBody}
//           />
//           {thread ? null : (
//             <>
//               <div style={{ marginTop: ".5em" }}>
//                 <button className="action-btn" onClick={onClickPost}>
//                   Create
//                 </button>
//               </div>
//               <strong>{postMsg}</strong>
//             </>
//           )}
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar
//             points={thread?.points || 0}
//             responseCount={
//               (thread && thread.threadItems && thread.threadItems.length) || 0
//             }
//             threadId={thread?.id || "0"}
//             allowUpdatePoints={true}
//             refreshThread={refreshThread}
//           />
//         </div>
//       </div>
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <div style={{ marginBottom: ".5em" }}>
//             <strong>Ask Aqua Questions</strong>
//           </div>
//           <ThreadResponse
//             body={""}
//             userId={userId}
//             userName={user?.userName}
//             lastModifiedOn={new Date()}
//             points={0}
//             readOnly={false}
//             threadItemId={"0"}
//             threadId={thread.id}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null} 
//       {thread ? (
//         <div className="thread-content-response-container">
//           <hr className="thread-section-divider" />
//           <ThreadResponsesBuilder
//             threadItems={thread?.threadItems}
//             readOnly={readOnly}
//             refreshThread={refreshThread}
//           />
//         </div>
//       ) : null}
//     </div>
//   );
// };





//   return (
//     <div className="screen-root-container">
//       <div className="thread-nav-container">
//         <Nav />
//       </div>
//       <div className="thread-content-container">
//         <div className="thread-content-post-container">
//           <ThreadHeader
//             userName={thread?.userName}
//             lastModifiedOn={thread ? thread.lastModifiedOn : new Date()}
//             title={thread?.title}
//           />
//           <ThreadCategory categoryName={thread?.category?.name} />
//           <ThreadTitle title={thread?.title} />
//           <ThreadBody body={thread?.body} />
//         </div>
//         <div className="thread-content-points-container">
//           <ThreadPointsBar
//             points={thread?.points || 0}
//             responseCount={
//               thread && thread.threadItems && thread.threadItems.length
//             }
//           />
//         </div>
//       </div>
//       <div className="thread-content-response-container">
//         <hr className="thread-section-divider" />
//         <ThreadResponsesBuilder threadItems={thread?.threadItems} />
//       </div>
//     </div>
//   );
// };

// export default Thread;