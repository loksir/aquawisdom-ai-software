// // import { getManager } from "typeorm";
import { AppDataSource_Joint_UT_SQL_CAP_S1_C1 } from "../index";
import { ThreadItem } from "./ThreadItem";
import { ThreadItemPoint } from "./ThreadItemPoint";
import { User } from "./User";


export const updateThreadItemPoint = async (
  userId: string,
  threadItemId: string,
  increment: boolean
): Promise<string> => {
  if (!userId || userId === "0") {
    return "User is not authenticated";
  }

  let message = "Failed to increment thread item point";
  
  // FIX: Parse IDs to numbers
  const threadItem = await ThreadItem.findOne({
    where: { id: Number(threadItemId) },
    relations: ["user"],
  });
  
  if (!threadItem) return "Thread item not found";
  
  // if (threadItem.user!.id === Number(userId)) {
  //   return "Error: users cannot increment their own thread item";
  // }

  const user = await User.findOne({ where: { id: Number(userId) } });
  if (!user) return "User not found";

  const existingPoint = await ThreadItemPoint.findOne({
    where: {
      threadItem: { id: Number(threadItemId) },
      user: { id: Number(userId) },
    },
    relations: ["threadItem"],
  });

  // FIX: Use the transactionEntityManager for all DB operations inside the transaction
  await AppDataSource_Joint_UT_SQL_CAP_S1_C1.manager.transaction(async (transactionEntityManager) => {
    if (existingPoint) {
      if (increment) {
        if (existingPoint.isDecrement) {
          await transactionEntityManager.remove(ThreadItemPoint, existingPoint);
          threadItem!.points = Number(threadItem!.points) + 1;
        }
      } else {
        if (!existingPoint.isDecrement) {
          await transactionEntityManager.remove(ThreadItemPoint, existingPoint);
          threadItem!.points = Number(threadItem!.points) - 1;
        }
      }
    } else {
      const newPoint = ThreadItemPoint.create({
        threadItem,
        isDecrement: !increment,
        user,
      });
      await transactionEntityManager.save(ThreadItemPoint, newPoint);
      
      if (increment) {
        threadItem!.points = Number(threadItem!.points) + 1;
      } else {
        threadItem!.points = Number(threadItem!.points) - 1;
      }
    }
    
    threadItem!.lastModifiedOn = new Date();
    await transactionEntityManager.save(ThreadItem, threadItem!);

    message = `Successfully ${increment ? "incremented" : "decremented"} point.`;
  });

  return message;
};

// const manager = AppDataSource_Joint_UT_SQL_CAP_S1_C1.manager;

// export const updateThreadItemPoint = async (
//   userId: string,
//   threadItemId: string,
//   increment: boolean
// ): Promise<string> => {
//   if (!userId || userId === "0") {
//     return "User is not authenticated";
//   }

//   let message = "Failed to increment thread item point";
//   const threadItem = await ThreadItem.findOne({
//     where: { id: Number(threadItemId) },
//     relations: ["user"],
//   });
//   console.log(
//     "threadItemId, userId, threadItem!.user!.id",
//     threadItemId,
//     userId,
//     threadItem!.user!.id
//   );
//   if (threadItem!.user!.id === parseInt(userId)) {
//     message = "Error: users cannot increment their own thread item";
//     console.log("incThreadItemPoints", message);
//     return message;
//   }
//   const user = await User.findOne({ where: { id: Number(userId) } });

//   const existingPoint = await ThreadItemPoint.findOne({
//     where: {
//       threadItem: { id: Number(threadItemId) },
//       user: { id: Number(userId) },
//     },
//     relations: ["threadItem"],
//   });

//   await AppDataSource_Joint_UT_SQL_CAP_S1_C1.manager.transaction(async (transactionEntityManager) => {
//     if (existingPoint) {
//       console.log("existingPoint");
//       if (increment) {
//         console.log("increment");
//         if (existingPoint.isDecrement) {
//           console.log("remove dec");
//           await ThreadItemPoint.remove(existingPoint);
//           threadItem!.points = Number(threadItem!.points) + 1;
//           threadItem!.lastModifiedOn = new Date();
//           await threadItem!.save();
//         }
//       } else {
//         if (!existingPoint.isDecrement) {
//           console.log("remove inc");
//           await ThreadItemPoint.remove(existingPoint);
//           threadItem!.points = Number(threadItem!.points) - 1;
//           threadItem!.lastModifiedOn = new Date();
//           await threadItem!.save();
//         }
//       }
//     } else {
//       console.log("new threadItem point");
//       await ThreadItemPoint.create({
//         threadItem,
//         isDecrement: !increment,
//         user,
//       }).save();
//       if (increment) {
//         threadItem!.points = Number(threadItem!.points) + 1;
//       } else {
//         threadItem!.points = Number(threadItem!.points) - 1;
//       }
//       threadItem!.lastModifiedOn = new Date();
//       await threadItem!.save();
//     }

//     message = `Successfully ${
//       increment ? "incremented" : "decremented"
//     } point.`;
//   });

//   return message;
// };