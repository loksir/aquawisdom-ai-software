import React, { FC, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { gql, useMutation } from "@apollo/client";
import "./ThreadPointsInline.css";
import useUpdateThreadPoint from "../../hooks/useUpdateThreadPoint";

const UpdateThreadItemPoint = gql`
  mutation UpdateThreadItemPoint($threadItemId: ID!, $increment: Boolean!) {
    updateThreadItemPoint(threadItemId: $threadItemId, increment: $increment)
  }
`;

class ThreadPointsInlineProps {
  points: number = 0;
  threadId?: string;
  threadItemId?: string;
  allowUpdatePoints?: boolean = false;
  refreshThread?: () => void;
}

const ThreadPointsInline: FC<ThreadPointsInlineProps> = ({
  points,
  threadId,
  threadItemId,
  allowUpdatePoints,
  refreshThread,
}) => {
  // FIX: Use local state for instant UI updates
  const [localPoints, setLocalPoints] = useState(points);

  // Sync local state if the parent props change (e.g., after refreshThread)
  useEffect(() => {
    setLocalPoints(points);
  }, [points]);

  const [execUpdateThreadItemPoint] = useMutation(UpdateThreadItemPoint);
  const { onClickDecThreadPoint, onClickIncThreadPoint } = useUpdateThreadPoint(
    refreshThread,
    threadId
  );

  const onClickIncThreadItemPoint = async (
    e: React.MouseEvent<SVGSVGElement, MouseEvent>
  ) => {
    e.preventDefault();
    
    // 1. Instantly update UI
    setLocalPoints((prev) => prev + 1);
    
    // 2. Send mutation
    const result = await execUpdateThreadItemPoint({
      variables: { threadItemId, increment: true },
    });
    
    // 3. If backend rejects (e.g., own post), rollback UI
    if (result?.data?.updateThreadItemPoint?.includes("Error")) {
      setLocalPoints((prev) => prev - 1);
      alert(result.data.updateThreadItemPoint);
    }
    
    refreshThread && refreshThread();
  };
  
  const onClickDecThreadItemPoint = async (
    e: React.MouseEvent<SVGSVGElement, MouseEvent>
  ) => {
    e.preventDefault();
    
    // 1. Instantly update UI
    setLocalPoints((prev) => prev - 1);
    
    // 2. Send mutation
    const result = await execUpdateThreadItemPoint({
      variables: { threadItemId, increment: false },
    });
    
    // 3. If backend rejects, rollback UI
    if (result?.data?.updateThreadItemPoint?.includes("Error")) {
      setLocalPoints((prev) => prev + 1);
      alert(result.data.updateThreadItemPoint);
    }
    
    refreshThread && refreshThread();
  };

  return (
    <span className="threadpointsinline-item">
      <div
        className="threadpointsinline-item-btn"
        style={{ display: `${allowUpdatePoints ? "block" : "none"}` }}
      >
        <FontAwesomeIcon
          icon={faChevronUp}
          className="point-icon"
          onClick={threadId ? onClickIncThreadPoint : onClickIncThreadItemPoint}
        />
      </div>
      {/* FIX: Render localPoints instead of points */}
      {localPoints}
      <div
        className="threadpointsinline-item-btn"
        style={{ display: `${allowUpdatePoints ? "block" : "none"}` }}
      >
        <FontAwesomeIcon
          icon={faChevronDown}
          className="point-icon"
          onClick={threadId ? onClickDecThreadPoint : onClickDecThreadItemPoint}
        />
      </div>
      <div className="threadpointsinline-item-btn">
        <FontAwesomeIcon icon={faHeart} className="points-icon" />
      </div>
    </span>
  );
};

export default ThreadPointsInline;

// import React, { FC } from "react";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import {
//   faHeart,
//   faChevronDown,
//   faChevronUp,
// } from "@fortawesome/free-solid-svg-icons";
// import { gql, useMutation } from "@apollo/client";
// import "./ThreadPointsInline.css";
// import useUpdateThreadPoint from "../../hooks/useUpdateThreadPoint";

// const UpdateThreadItemPoint = gql`
//   mutation UpdateThreadItemPoint($threadItemId: ID!, $increment: Boolean!) {
//     updateThreadItemPoint(threadItemId: $threadItemId, increment: $increment)
//   }
// `;

// class ThreadPointsInlineProps {
//   points: number = 0;
//   threadId?: string;
//   threadItemId?: string;
//   allowUpdatePoints?: boolean = false;
//   refreshThread?: () => void;
// }

// const ThreadPointsInline: FC<ThreadPointsInlineProps> = ({
//   points,
//   threadId,
//   threadItemId,
//   allowUpdatePoints,
//   refreshThread,
// }) => {
//   const [execUpdateThreadItemPoint] = useMutation(UpdateThreadItemPoint);
//   const { onClickDecThreadPoint, onClickIncThreadPoint } = useUpdateThreadPoint(
//     refreshThread,
//     threadId
//   );

//     const onClickIncThreadItemPoint = async (
//     e: React.MouseEvent<SVGSVGElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     const result = await execUpdateThreadItemPoint({
//       variables: {
//         threadItemId,
//         increment: true,
//       },
//     });
    
//     // FIX: Log the actual response from the backend to see why it's failing
//     console.log("👍 Like Result:", result?.data?.updateThreadItemPoint);
    
//     refreshThread && refreshThread();
//   };
  
//   const onClickDecThreadItemPoint = async (
//     e: React.MouseEvent<SVGSVGElement, MouseEvent>
//   ) => {
//     e.preventDefault();

//     const result = await execUpdateThreadItemPoint({
//       variables: {
//         threadItemId,
//         increment: false,
//       },
//     });
    
//     // FIX: Log the actual response from the backend
//     console.log("👎 Dislike Result:", result?.data?.updateThreadItemPoint);
    
//     refreshThread && refreshThread();
  // };

  // const onClickIncThreadItemPoint = async (
  //   e: React.MouseEvent<SVGSVGElement, MouseEvent>
  // ) => {
  //   e.preventDefault();

  //   await execUpdateThreadItemPoint({
  //     variables: {
  //       threadItemId,
  //       increment: true,
  //     },
  //   });
  //   refreshThread && refreshThread();
  // };
  // const onClickDecThreadItemPoint = async (
  //   e: React.MouseEvent<SVGSVGElement, MouseEvent>
  // ) => {
  //   e.preventDefault();

  //   await execUpdateThreadItemPoint({
  //     variables: {
  //       threadItemId,
  //       increment: false,
  //     },
  //   });
  //   refreshThread && refreshThread();
  // };

//   return (
//     <span className="threadpointsinline-item">
//       <div
//         className="threadpointsinline-item-btn"
//         style={{ display: `${allowUpdatePoints ? "block" : "none"}` }}
//       >
//         <FontAwesomeIcon
//           icon={faChevronUp}
//           className="point-icon"
//           onClick={threadId ? onClickIncThreadPoint : onClickIncThreadItemPoint}
//         />
//       </div>
//       {points}
//       <div
//         className="threadpointsinline-item-btn"
//         style={{ display: `${allowUpdatePoints ? "block" : "none"}` }}
//       >
//         <FontAwesomeIcon
//           icon={faChevronDown}
//           className="point-icon"
//            onClick={threadId ? onClickDecThreadPoint : onClickDecThreadItemPoint}
//         />
//       </div>
//       <div className="threadpointsinline-item-btn">
//         <FontAwesomeIcon icon={faHeart} className="points-icon" />
//       </div>
//     </span>
//   );
// };

// export default ThreadPointsInline;



// import React, { FC } from "react";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faHeart } from "@fortawesome/free-solid-svg-icons";
// import { ThreadPointsBarProps } from "./ThreadPointsBar";





// const ThreadPointsInline: FC<ThreadPointsBarProps> = ({
//   points,
//   responseCount,
// }) => {
//   return (
//     <React.Fragment>
//       <label
//         style={{
//           marginRight: ".75em",
//           marginTop: ".25em",
//         }}
//       >
//         {points || 0}
//         <FontAwesomeIcon
//           icon={faHeart}
//           className="points-icon"
//           style={{
//             marginLeft: ".2em",
//           }}
//         />
//       </label>
//     </React.Fragment>
//   );
// };

// export default ThreadPointsInline;