import React, { FC, useEffect, useState, useRef } from "react";
import RichEditor from "../../editor/RichEditor";
import UserNameAndTime from "./UserNameAndTime";
import ThreadPointsInline from "../../points/ThreadPointsInline";
import { gql, useMutation } from "@apollo/client";
import { Node } from "slate";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../../../store/AppState";
import { UiSetAiThinkingType } from "../../../store/ui/Reducer";

const CreateThreadItem = gql`
  mutation createThreadItem($userId: ID!, $threadId: ID!, $body: String!) {
    createThreadItem(userId: $userId, threadId: $threadId, body: $body) {
      messages
    }
  }
`;

interface ThreadResponseProps {
  userId: string;
  body?: string;
  userName?: string;
  lastModifiedOn?: Date;
  points: number;
  readOnly: boolean;
  threadItemId: string;
  threadId?: string;
  refreshThread?: () => void;
}

const ThreadResponse: FC<ThreadResponseProps> = ({
  body, userName, lastModifiedOn, points, readOnly, threadItemId, threadId, refreshThread,
}) => {
  const user = useSelector((state: AppState) => state.user);
  const uiState = useSelector((state: AppState) => state.ui);
  const dispatch = useDispatch();
  
  const [execCreateThreadItem] = useMutation(CreateThreadItem);
  const [postMsg, setPostMsg] = useState("");
  const bodyNodeRef = useRef<Node[] | null>(null);
  const [hasText, setHasText] = useState(false);

  const isLoading = uiState.isAiThinking && uiState.thinkingThreadId === threadId;

  useEffect(() => {
    if (body) {
      try {
        bodyNodeRef.current = JSON.parse(body);
        setHasText(true);
      } catch (e) {
        bodyNodeRef.current = null;
        setHasText(false);
      }
    } else {
      bodyNodeRef.current = null;
      setHasText(false);
    }
  }, [body]);

  const onClickPost = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (isLoading) return;

    if (!user) {
      setPostMsg("Please login before adding a response.");
    } else if (!threadId) {
      setPostMsg("A parent thread must exist before a response can be posted.");
    } else if (!hasText || !bodyNodeRef.current) {
      setPostMsg("Please enter some text.");
    } else {
      setPostMsg("");
      dispatch({ type: UiSetAiThinkingType, payload: { isThinking: true, threadId: threadId } });
      
      const bodyString = JSON.stringify(bodyNodeRef.current);
      try {
        await execCreateThreadItem({ variables: { userId: user.id, threadId, body: bodyString } });
        bodyNodeRef.current = null;
        setHasText(false);
        
        // EXACT ORIGINAL LOGIC: Just call refreshThread() and let Thread.tsx handle the UI update
        refreshThread && refreshThread();
      } catch (error) {
        console.error("Mutation error:", error);
        setPostMsg("Failed to get response from AI.");
      } finally {
        dispatch({ type: UiSetAiThinkingType, payload: { isThinking: false, threadId: null } });
      }
    }
  };

  const receiveBody = (bodyNodes: Node[]) => {
    bodyNodeRef.current = bodyNodes;
    const text = bodyNodes.map(n => Node.string(n)).join('\n');
    setHasText(text.trim().length > 0);
  };

  return (
    <div>
      <div>
        <UserNameAndTime userName={userName} lastModifiedOn={lastModifiedOn} />
        {threadItemId}
        {readOnly ? (
          <span style={{ display: "inline-block", marginLeft: "1em" }}>
            <ThreadPointsInline points={points || 0} threadItemId={threadItemId} refreshThread={refreshThread} allowUpdatePoints={true} />
          </span>
        ) : null}
      </div>
      <div className="thread-body-editor">
        <RichEditor existingBody={body || ""} readOnly={readOnly || isLoading} sendOutBody={receiveBody} />
      </div>
      {!readOnly && threadId ? (
        <>
          <div style={{ marginTop: ".5em" }}>
            <button className="action-btn" onClick={onClickPost} disabled={isLoading}>
              {isLoading ? 'Aqua is thinking...' : 'Ask Aqua'}
            </button>
          </div>
          
          {isLoading && (
            <div className="ai-thinking-container" style={{ marginTop: '10px' }}>
              <span className="ai-thinking-text">Aqua is generating response</span>
              <span className="ai-thinking-dot"></span>
              <span className="ai-thinking-dot"></span>
              <span className="ai-thinking-dot"></span>
            </div>
          )}
          
          {!isLoading && <strong>{postMsg}</strong>}
        </>
      ) : null}
    </div>
  );
};

export default ThreadResponse;

// import React, { FC, useEffect, useState, useRef } from "react";
// import RichEditor from "../../editor/RichEditor";
// import UserNameAndTime from "./UserNameAndTime";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import { gql, useMutation } from "@apollo/client";
// import { Node } from "slate";
// import { useSelector, useDispatch } from "react-redux";
// import { AppState } from "../../../store/AppState";
// import { UiSetAiThinkingType } from "../../../store/ui/Reducer";

// const CreateThreadItem = gql`
//   mutation createThreadItem($userId: ID!, $threadId: ID!, $body: String!) {
//     createThreadItem(userId: $userId, threadId: $threadId, body: $body) {
//       messages
//     }
//   }
// `;

// interface ThreadResponseProps {
//   userId: string;
//   body?: string;
//   userName?: string;
//   lastModifiedOn?: Date;
//   points: number;
//   readOnly: boolean;
//   threadItemId: string;
//   threadId?: string;
//   refreshThread?: () => void;
// }

// const ThreadResponse: FC<ThreadResponseProps> = ({
//   body,
//   userName,
//   lastModifiedOn,
//   points,
//   readOnly,
//   threadItemId,
//   threadId,
//   refreshThread,
// }) => {
//   const user = useSelector((state: AppState) => state.user);
  
//   // FIX: Read global UI state
//   const uiState = useSelector((state: AppState) => state.ui);
//   const dispatch = useDispatch();
  
//   const [execCreateThreadItem] = useMutation(CreateThreadItem);
//   const [postMsg, setPostMsg] = useState("");
  
//   const bodyNodeRef = useRef<Node[] | null>(null);
//   const [hasText, setHasText] = useState(false);

//   // True only if THIS specific thread is currently generating
//   const isLoading = uiState.isAiThinking && uiState.thinkingThreadId === threadId;

//   useEffect(() => {
//     if (body) {
//       try {
//         bodyNodeRef.current = JSON.parse(body);
//         setHasText(true);
//       } catch (e) {
//         bodyNodeRef.current = null;
//         setHasText(false);
//       }
//     } else {
//       bodyNodeRef.current = null;
//       setHasText(false);
//     }
//   }, [body]);

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     if (isLoading) return; // Prevent double-clicking

//     if (!user) {
//       setPostMsg("Please login before adding a response.");
//     } else if (!threadId) {
//       setPostMsg("A parent thread must exist before a response can be posted.");
//     } else if (!hasText || !bodyNodeRef.current) {
//       setPostMsg("Please enter some text.");
//     } else {
//       setPostMsg("");
      
//       // 1. Tell Redux globally that we are thinking
//       dispatch({ 
//         type: UiSetAiThinkingType, 
//         payload: { isThinking: true, threadId: threadId } 
//       });
      
//       const bodyString = JSON.stringify(bodyNodeRef.current);
      
//       try {
//         await execCreateThreadItem({
//           variables: {
//             userId: user ? user.id : "0",
//             threadId,
//             body: bodyString,
//           },
//         });
        
//         // Clear the editor locally after submission
//         bodyNodeRef.current = null;
//         setHasText(false);
//         refreshThread && refreshThread();
//       } catch (error) {
//         console.error("Mutation error:", error);
//         setPostMsg("Failed to get response from AI.");
//       } finally {
//         // 2. Tell Redux globally that we are done thinking
//         dispatch({ 
//           type: UiSetAiThinkingType, 
//           payload: { isThinking: false, threadId: null } 
//         });
//       }
//     }
//   };

//   const receiveBody = (bodyNodes: Node[]) => {
//     bodyNodeRef.current = bodyNodes;
//     const text = bodyNodes.map(n => Node.string(n)).join('\n');
//     setHasText(text.trim().length > 0);
//   };

//   return (
//     <div>
//       <div>
//         <UserNameAndTime userName={userName} lastModifiedOn={lastModifiedOn} />
//         {threadItemId}
//         {readOnly ? (
//           <span style={{ display: "inline-block", marginLeft: "1em" }}>
//             <ThreadPointsInline
//               points={points || 0}
//               threadItemId={threadItemId}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           </span>
//         ) : null}
//       </div>
//       <div className="thread-body-editor">
//         <RichEditor
//           existingBody={body || ""}
//           readOnly={readOnly || isLoading} // Lock editor while AI is thinking
//           sendOutBody={receiveBody}
//         />
//       </div>
//       {!readOnly && threadId ? (
//         <>
//           <div style={{ marginTop: ".5em" }}>
//             <button className="action-btn" onClick={onClickPost} disabled={isLoading}>
//               {isLoading ? 'Aqua is thinking...' : 'Ask Aqua'}
//             </button>
//           </div>
          
//           {/* Animated Thinking Indicator (Controlled by Global State) */}
//           {isLoading && (
//             <div className="ai-thinking-container" style={{ marginTop: '10px' }}>
//               <span className="ai-thinking-text">Aqua is generating response</span>
//               <span className="ai-thinking-dot"></span>
//               <span className="ai-thinking-dot"></span>
//               <span className="ai-thinking-dot"></span>
//             </div>
//           )}
          
//           {!isLoading && <strong>{postMsg}</strong>}
//         </>
//       ) : null}
//     </div>
//   );
// };

// export default ThreadResponse;

// import React, { FC, useEffect, useState, useRef } from "react";
// import RichEditor from "../../editor/RichEditor";
// import UserNameAndTime from "./UserNameAndTime";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import { gql, useMutation } from "@apollo/client";
// import { Node } from "slate";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";

// const CreateThreadItem = gql`
//   mutation createThreadItem($userId: ID!, $threadId: ID!, $body: String!) {
//     createThreadItem(userId: $userId, threadId: $threadId, body: $body) {
//       messages
//     }
//   }
// `;

// interface ThreadResponseProps {
//   userId: string;
//   body?: string;
//   userName?: string;
//   lastModifiedOn?: Date;
//   points: number;
//   readOnly: boolean;
//   threadItemId: string;
//   threadId?: string;
//   refreshThread?: () => void;
// }

// const ThreadResponse: FC<ThreadResponseProps> = ({
//   body,
//   userName,
//   lastModifiedOn,
//   points,
//   readOnly,
//   threadItemId,
//   threadId,
//   refreshThread,
// }) => {
//   const user = useSelector((state: AppState) => state.user);
//   const [execCreateThreadItem] = useMutation(CreateThreadItem);
//   const [postMsg, setPostMsg] = useState("");
  
//   // FIX: Use refs instead of state to prevent re-rendering RichEditor on every keystroke
//   const bodyNodeRef = useRef<Node[] | null>(null);
//   const [hasText, setHasText] = useState(false); // Only track boolean for button disabling

//   const [isLoading, setIsLoading] = useState(false);
//   const [isButtonDisabled, setIsButtonDisabled] = useState(false);

//   useEffect(() => {
//     if (body) {
//       try {
//         bodyNodeRef.current = JSON.parse(body);
//         setHasText(true);
//       } catch (e) {
//         bodyNodeRef.current = null;
//         setHasText(false);
//       }
//     } else {
//       bodyNodeRef.current = null;
//       setHasText(false);
//     }
//   }, [body]);

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     if (isButtonDisabled) return;

//     setIsButtonDisabled(true);
//     setIsLoading(true);

//     if (!user) {
//       setPostMsg("Please login before adding a response.");
//     } else if (!threadId) {
//       setPostMsg("A parent thread must exist before a response can be posted.");
//     } else if (!hasText || !bodyNodeRef.current) {
//       setPostMsg("Please enter some text.");
//     } else {
//       setPostMsg("");
      
//       // Stringify the ref data right before sending
//       const bodyString = JSON.stringify(bodyNodeRef.current);
      
//       await execCreateThreadItem({
//         variables: {
//           userId: user ? user.id : "0",
//           threadId,
//           body: bodyString,
//         },
//       });
      
//       // Clear the editor locally after submission
//       bodyNodeRef.current = null;
//       setHasText(false);
//       refreshThread && refreshThread();
//     }

//     setIsButtonDisabled(false);
//     setIsLoading(false);
//   };

//   const receiveBody = (bodyNodes: Node[]) => {
//     // FIX: Store nodes in ref, only update a boolean state to enable/disable the button
//     bodyNodeRef.current = bodyNodes;
//     const text = bodyNodes.map(n => Node.string(n)).join('\n');
//     setHasText(text.trim().length > 0);
//   };

//   return (
//     <div>
//       <div>
//         <UserNameAndTime userName={userName} lastModifiedOn={lastModifiedOn} />
//         {threadItemId}
//         {readOnly ? (
//           <span style={{ display: "inline-block", marginLeft: "1em" }}>
//             <ThreadPointsInline
//               points={points || 0}
//               threadItemId={threadItemId}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           </span>
//         ) : null}
//       </div>
//       <div className="thread-body-editor">
//         <RichEditor
//           // FIX: Pass the initial 'body' prop directly. Do not feed state back in.
//           existingBody={body || ""}
//           readOnly={readOnly}
//           sendOutBody={receiveBody}
//         />
//       </div>
//       {!readOnly && threadId ? (
//         <>
//           <div style={{ marginTop: ".5em" }}>
//             <button className="action-btn" onClick={onClickPost} disabled={isButtonDisabled}>
//               {isLoading ? 'Aqua is thinking...' : 'Ask Aqua'}
//             </button>
//           </div>
          
//           {/* Animated Thinking Indicator */}
//           {isLoading && (
//             <div className="ai-thinking-container" style={{ marginTop: '10px' }}>
//               <span className="ai-thinking-text">Aqua is generating response</span>
//               <span className="ai-thinking-dot"></span>
//               <span className="ai-thinking-dot"></span>
//               <span className="ai-thinking-dot"></span>
//             </div>
//           )}
          
//           {!isLoading && <strong>{postMsg}</strong>}
//         </>
//       ) : null}
//     </div>
//   );
// };

// export default ThreadResponse;

// import React, { FC, useEffect, useState, useCallback } from "react";
// import RichEditor from "../../editor/RichEditor";
// import UserNameAndTime from "./UserNameAndTime";
// import ThreadPointsInline from "../../points/ThreadPointsInline";
// import { gql, useMutation } from "@apollo/client";
// import { Node } from "slate";
// import { useSelector } from "react-redux";
// import { AppState } from "../../../store/AppState";
// // import debounce from 'lodash.debounce';


// const CreateThreadItem = gql`
//   mutation createThreadItem($userId: ID!, $threadId: ID!, $body: String!) {
//     createThreadItem(userId: $userId, threadId: $threadId, body: $body) {
//       messages
//     }
//   }
// `;

// interface ThreadResponseProps {
//   userId: string;
//   body?: string;
//   userName?: string;
//   lastModifiedOn?: Date;
//   points: number;
//   readOnly: boolean;
//   threadItemId: string;
//   threadId?: string;
//   refreshThread?: () => void;
// }

// const ThreadResponse: FC<ThreadResponseProps> = ({
//   body,
//   userName,
//   lastModifiedOn,
//   points,
//   readOnly,
//   threadItemId,
//   threadId,
//   refreshThread,
// }) => {
//   const user = useSelector((state: AppState) => state.user);
//   const [execCreateThreadItem] = useMutation(CreateThreadItem);
//   const [postMsg, setPostMsg] = useState("");
//   const [bodyToSave, setBodyToSave] = useState("");
//   // const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isButtonDisabled, setIsButtonDisabled] = useState(false);

//   useEffect(() => {
//     if (body) {
//       setBodyToSave(body || "");
//     }
//   }, [body]);

//   const onClickPost = async (
//     e: React.MouseEvent<HTMLButtonElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     if (isButtonDisabled) return;

//         console.log('Button clicked!');
//         setIsButtonDisabled(true);
//         setIsLoading(true);


//     if (!user) {
//       setPostMsg("Please login before adding a response.");
//     } else if (!threadId) {
//       setPostMsg("A parent thread must exist before a response can be posted.");
//     } else if (!bodyToSave) {
//       setPostMsg("Please enter some text.");
//     } else {
//       await execCreateThreadItem({
//         variables: {
//           userId: user ? user.id : "0",
//           threadId,
//           body: bodyToSave,
//         },
//       });
//       refreshThread && refreshThread();
//     }

//     // Re-enable the button after the API call
//         setIsButtonDisabled(false);
//         setIsLoading(false);

// //  // Disable the button
// //         setIsSubmitting(true);

// //         // Re-enable the button after a delay
// //         setTimeout(() => {
// //             setIsSubmitting(false);
// //         }, 3000); // Adjust the delay as needed (3000 ms = 3 seconds)

//   };

//   // const debouncedHandleClick = useCallback(
//   //   debounce(onClickPost, 300, { leading: true }),
//   //   [] // Empty dependency array ensures the debounced function is created once
//   // );



//   const receiveBody = (body: Node[]) => {
//     const newBody = JSON.stringify(body);
//     if (bodyToSave !== newBody) {
//       setBodyToSave(newBody);
//     }
//   };

//   return (
//     <div>
//       <div>
//         <UserNameAndTime userName={userName} lastModifiedOn={lastModifiedOn} />
//         {threadItemId}
//         {readOnly ? (
//           <span style={{ display: "inline-block", marginLeft: "1em" }}>
//             <ThreadPointsInline
//               points={points || 0}
//               threadItemId={threadItemId}
//               refreshThread={refreshThread}
//               allowUpdatePoints={true}
//             />
//           </span>
//         ) : null}
//       </div>
//       <div className="thread-body-editor">
//         <RichEditor
//           existingBody={bodyToSave}
//           readOnly={readOnly}
//           sendOutBody={receiveBody}
//         />
//       </div>
//       {!readOnly && threadId ? (
//         <>
//           <div style={{ marginTop: ".5em" }}>
//             <button className="action-btn" onClick={onClickPost} disabled={isButtonDisabled}>
//                  {isLoading ? 'Aqua is thinking...pls wait' : 'Ask Aqua'}
//             </button>
//           </div>
       
//        {/* FIX: New Animated Thinking Indicator */}
//           {isLoading && (
//             <div className="ai-thinking-container" style={{ marginTop: '10px' }}>
//               <span className="ai-thinking-text">Aqua is generating response</span>
//               <span className="ai-thinking-dot"></span>
//               <span className="ai-thinking-dot"></span>
//               <span className="ai-thinking-dot"></span>
//             </div>
//           )}
          
//           {!isLoading && <strong>{postMsg}</strong>}
//           {/* <strong>{postMsg}</strong> */}
//         </>
//       ) : null}
//     </div>
//   );
// };

// export default ThreadResponse;