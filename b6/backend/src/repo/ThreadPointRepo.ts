// import { getManager } from "typeorm";
import { AppDataSource_Joint_UT_SQL_CAP_S1_B6 } from "../index"
import { Thread } from "./Thread";
import { ThreadPoint } from "./ThreadPoint";
import { User } from "./User";

// const manager = AppDataSource_Joint_UT_SQL_CAP_S1_B6.manager;

export const updateThreadPoint = async (
  userId: string,
  threadId: string,
  increment: boolean
): Promise<string> => {
  if (!userId || userId === "0") {
    return "User is not authenticated";
  }

  let message = "Failed to increment thread point";
  const thread = await Thread.findOne({
    where: { id: Number(threadId) },
    relations: ["user"],
  });
  // if (thread!.user!.id === Number(userId)) {
  //   message = "Error: users cannot increment their own thread";
  //   console.log("incThreadPoints", message);
  //   return message;
  // }
  const user = await User.findOne({ where: { id: Number(userId) } });

  const existingPoint = await ThreadPoint.findOne({
    where: {
      thread: { id: Number(threadId) },
      user: { id: Number(userId) },
    },
    relations: ["thread"],
  });
  await AppDataSource_Joint_UT_SQL_CAP_S1_B6.manager.transaction(async (transactionEntityManager) => {
    if (existingPoint) {
      if (increment) {
        if (existingPoint.isDecrement) {
          console.log("remove dec");
          await ThreadPoint.remove(existingPoint);
          thread!.points = Number(thread!.points) + 1;
          thread!.lastModifiedOn = new Date();
          await thread!.save();
        }
      } else {
        if (!existingPoint.isDecrement) {
          console.log("remove inc");
          await ThreadPoint.remove(existingPoint);
          thread!.points = Number(thread!.points) - 1;
          thread!.lastModifiedOn = new Date();
          await thread!.save();
        }
      }
    } else {
      console.log("new point");
      await ThreadPoint.create({
        thread,
        isDecrement: !increment,
        user,
      }).save();
      if (increment) {
        thread!.points = Number(thread!.points) + 1;
      } else {
        thread!.points = Number(thread!.points) - 1;
      }
      thread!.lastModifiedOn = new Date();
      await thread!.save();
    }

    message = `Successfully ${
      increment ? "incremented" : "decremented"
    } point.`;
  });

  return message;
};