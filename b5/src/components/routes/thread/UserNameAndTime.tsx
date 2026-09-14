import React, { FC } from "react";
import { getTimePastIfLessThanDay } from "../../../common/dates";

interface UserNameAndTimeProps {
  userName?: string;
  lastModifiedOn?: Date | string; // Allow string since Apollo/SQLite return strings
}

const UserNameAndTime: FC<UserNameAndTimeProps> = ({
  userName,
  lastModifiedOn,
}) => {
  // FIX: Convert string to Date object to prevent "NaNm ago" from date-fns
  const dateObj = lastModifiedOn ? new Date(lastModifiedOn) : undefined;

  return (
    <span>
      <strong>{userName}</strong>
      <label style={{ marginLeft: "1em" }}>
        {dateObj ? getTimePastIfLessThanDay(dateObj) : ""}
      </label>
    </span>
  );
};

export default UserNameAndTime;

// import React, { FC } from "react";
// import { getTimePastIfLessThanDay } from "../../../common/dates";

// interface UserNameAndTimeProps {
//   userName?: string;
//   lastModifiedOn?: Date;
// }

// const UserNameAndTime: FC<UserNameAndTimeProps> = ({
//   userName,
//   lastModifiedOn,
// }) => {
//   return (
//     <span>
//       <strong>{userName}</strong>
//       <label style={{ marginLeft: "1em" }}>
//         {lastModifiedOn ? getTimePastIfLessThanDay(lastModifiedOn) : ""}
//       </label>
//     </span>
//   );
// };

// export default UserNameAndTime;