
import { format } from "date-fns";
import { differenceInMinutes } from "date-fns";

const StandardDateTimeFormat = "M/dd/yyyy";

const getTimePastIfLessThanDay = (compTime: Date | string | null | undefined): string => {
  if (!compTime) return "";

  let dateObj: Date;
  
  // FIX: Handle SQLite/Backend strings that lack timezone markers
  if (typeof compTime === 'string') {
    // If it has a space (e.g., "2026-07-30 14:00:00") but no 'Z' or '+', it's a naive UTC timestamp
    if (compTime.includes(' ') && !compTime.endsWith('Z') && !compTime.includes('+')) {
      // Convert to ISO format and append 'Z' so JavaScript knows it's UTC
      compTime = compTime.replace(' ', 'T') + 'Z';
    }
    dateObj = new Date(compTime);
  } else {
    dateObj = compTime;
  }

  // If the date is invalid, return empty string
  if (isNaN(dateObj.getTime())) {
    return "";
  }

  const now = new Date();
  const diffInMinutes = differenceInMinutes(now, dateObj);
  
  if (diffInMinutes > 60) {
    if (diffInMinutes > 24 * 60) {
      return format(dateObj, StandardDateTimeFormat);
    }
    return Math.round(diffInMinutes / 60) + "h ago";
  }
  return Math.round(diffInMinutes) + "m ago";
};

export { getTimePastIfLessThanDay };

// import { format } from "date-fns";
// import { differenceInMinutes } from "date-fns";

// const StandardDateTimeFormat = "M/dd/yyyy";

// // FIX: Accept string | Date | null and strictly convert to Date object
// const getTimePastIfLessThanDay = (compTime: Date | string | null | undefined): string => {
//   if (!compTime) return "";

//   // Convert to Date object if it's a string
//   const dateObj = compTime instanceof Date ? compTime : new Date(compTime);

//   // If the date is invalid (NaN), return empty string to prevent "NaNm ago"
//   if (isNaN(dateObj.getTime())) {
//     console.log("🔴 INVALID DATE DETECTED. Raw value:", compTime);
//     return "";
//   }

//   const now = new Date();
//   const diffInMinutes = differenceInMinutes(now, dateObj);
  
//   if (diffInMinutes > 60) {
//     if (diffInMinutes > 24 * 60) {
//       return format(dateObj, StandardDateTimeFormat);
//     }
//     return Math.round(diffInMinutes / 60) + "h ago";
//   }
//   return Math.round(diffInMinutes) + "m ago";
// };

// export { getTimePastIfLessThanDay };

// import { format } from "date-fns";
// import { differenceInMinutes } from "date-fns";

// const StandardDateTimeFormat = "M/dd/yyyy";

// const getTimePastIfLessThanDay = (compTime: Date | string | null | undefined): string => {
//   if (!compTime || compTime === "") return "";

//   // Convert to Date object if it's a string
//   const dateObj = compTime instanceof Date ? compTime : new Date(compTime);

//   // DEBUG: Let's see exactly what date is causing the issue
//   if (isNaN(dateObj.getTime())) {
//     console.log("🔴 INVALID DATE DETECTED. Raw value:", compTime, "| Type:", typeof compTime);
//     return "Invalid Date";
//   }

//   const now = new Date();
//   const diffInMinutes = differenceInMinutes(now, dateObj);
  
//   if (diffInMinutes > 60) {
//     if (diffInMinutes > 24 * 60) {
//       return format(dateObj, StandardDateTimeFormat);
//     }
//     return Math.round(diffInMinutes / 60) + "h ago";
//   }
//   return Math.round(diffInMinutes) + "m ago";
// };

// export { getTimePastIfLessThanDay };

// import { format } from "date-fns";
// import { differenceInMinutes } from "date-fns";

// const StandardDateTimeFormat = "M/dd/yyyy";

// // FIX: Accept string | Date | null and strictly validate the date
// const getTimePastIfLessThanDay = (compTime: Date | string | null | undefined): string => {
//   if (!compTime) return "";

//   // Convert to Date object if it's a string
//   const dateObj = compTime instanceof Date ? compTime : new Date(compTime);

//   // FIX: If the date is invalid, return empty string to prevent "NaNm ago"
//   if (isNaN(dateObj.getTime())) {
//     console.log("Invalid date detected:", compTime);
//     return "";
//   }

//   const now = new Date();
//   const diffInMinutes = differenceInMinutes(now, dateObj);
  
//   if (diffInMinutes > 60) {
//     if (diffInMinutes > 24 * 60) {
//       return format(dateObj, StandardDateTimeFormat);
//     }
//     return Math.round(diffInMinutes / 60) + "h ago";
//   }
//   return Math.round(diffInMinutes) + "m ago";
// };

// export { getTimePastIfLessThanDay };

// import { format } from "date-fns";
// import { differenceInMinutes } from "date-fns";

// const StandardDateTimeFormat = "M/dd/yyyy";
// const getTimePastIfLessThanDay = (compTime: Date | null): string => {
//   if (!compTime) return "";

//   const now = new Date();
//   const diffInMinutes = differenceInMinutes(now, compTime);
//   console.log("diff", diffInMinutes);
//   if (diffInMinutes > 60) {
//     if (diffInMinutes > 24 * 60) {
//       return format(compTime, StandardDateTimeFormat);
//     }
//     return Math.round(diffInMinutes / 60) + "h ago";
//   }
//   return Math.round(diffInMinutes) + "m ago";
// };

// export { getTimePastIfLessThanDay };