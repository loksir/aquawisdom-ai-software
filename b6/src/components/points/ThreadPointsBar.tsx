import React, { FC } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faReplyAll,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { useWindowDimensions } from "../../hooks/useWindowDimensions";
import useUpdateThreadPoint from "../../hooks/useUpdateThreadPoint";
// import { gql, useMutation } from "@apollo/client";

// const UpdateThreadPoint = gql`
//   mutation UpdateThreadPoint(
//     $userId: ID!
//     $threadId: ID!
//     $increment: Boolean!
//   ) {
//     updateThreadPoint(
//       userId: $userId
//       threadId: $threadId
//       increment: $increment
//     )
//   }
// `;

export class ThreadPointsBarProps {
  points: number = 0;
  responseCount?: number;
  threadId?: string;
  allowUpdatePoints?: boolean = false;
  refreshThread?: () => void;
}

const ThreadPointsBar: FC<ThreadPointsBarProps> = ({
  points,
  responseCount,
  threadId,
  allowUpdatePoints,
  refreshThread,
}) => {
  const { width } = useWindowDimensions();
  // const [execUpdateThreadPoint] = useMutation(UpdateThreadPoint);
  const { onClickDecThreadPoint, onClickIncThreadPoint } = useUpdateThreadPoint(
    refreshThread,
    threadId
  );

// const onClickIncThreadPoint = async (
//     e: React.MouseEvent<SVGSVGElement, MouseEvent>
//   ) => {
//     e.preventDefault();
//     await execUpdateThreadPoint({
//       variables: {
//         threadId,
//         increment: true,
//       },
//     });
//     refreshThread && refreshThread();
//   };

//   const onClickDecThreadPoint = async (
//     e: React.MouseEvent<SVGSVGElement, MouseEvent>
//   ) => {
//     e.preventDefault();
//     await execUpdateThreadPoint({
//       variables: {
//         threadId,
//         increment: false,
//       },
//     });
//     refreshThread && refreshThread();
//   };

  if (width > 768) {
    console.log("ThreadPointsBar points", points);
    return (
      <div className="threadcard-points">
        <div className="threadcard-points-item">
          <div
            className="threadcard-points-item-btn"
            style={{ display: `${allowUpdatePoints ? "block" : "none"}` }}
          >
            <FontAwesomeIcon
              icon={faChevronUp}
              className="point-icon"
              onClick={onClickIncThreadPoint}
            />
          </div>
          {points}
          <div
            className="threadcard-points-item-btn"
            style={{ display: `${allowUpdatePoints ? "block" : "none"}` }}
          >
            <FontAwesomeIcon
              icon={faChevronDown}
              className="point-icon"
              onClick={onClickDecThreadPoint}
            />
          </div>
          <FontAwesomeIcon icon={faHeart} className="points-icon" />
        </div>
        <div className="threadcard-points-item">
          {responseCount}
          <br />
          <FontAwesomeIcon 
            icon={faReplyAll} 
            // FIX: Remove points-icon class and force green color
            style={{ color: "#28a745 !important" }} 
          />
          {/* <FontAwesomeIcon icon={faReplyAll} className="points-icon" /> */}
        </div>
      </div>
    );
  }
  return null;
};

export default ThreadPointsBar;


// import React, { FC } from "react";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faHeart, faReplyAll } from "@fortawesome/free-solid-svg-icons";
// import { useWindowDimensions } from "../../hooks/useWindowDimensions";

// export interface ThreadPointsBarProps {
//   points: number;
//   responseCount?: number;
// }

// const ThreadPointsBar: FC<ThreadPointsBarProps> = ({
//   points,
//   responseCount,
// }) => {
//   const { width } = useWindowDimensions();
//   if (width > 768) {
//     return (
//       <div className="threadcard-points">
//         <div className="threadcard-points-item">
//           {points}
//           <br />
//           <FontAwesomeIcon icon={faHeart} className="points-icon" />
//         </div>
//         <div className="threadcard-points-item">
//           {responseCount}
//           <br />
//           <FontAwesomeIcon icon={faReplyAll} className="points-icon" />
//         </div>
//       </div>
//     );
//   }
//   return null;
// };

// export default ThreadPointsBar;