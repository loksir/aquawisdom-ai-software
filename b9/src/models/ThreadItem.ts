import Thread from "./Thread";
import User from "./User";

export default class ThreadItem {
  constructor(
    public id: string,
    public views: number,
    public points: number,
    public body: string,
    public aiResponse: string,
    public user: User,
    // public userName: string,
    // public userId: string,
    public createdOn: Date,
    // public threadId: string
    public thread: Thread
  ) {}
}