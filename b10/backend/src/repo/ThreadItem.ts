import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany
} from "typeorm";
import { Length } from "class-validator";
import { Thread } from "./Thread";
import { User } from "./User";
import { ThreadItemPoint } from "./ThreadItemPoint";
import { Auditable } from "./Auditable";

@Entity({ name: "ThreadItems" })
export class ThreadItem extends Auditable {
  @PrimaryGeneratedColumn("increment", { name: "Id" })
  id: number;

  @Column("int", { name: "Views", default: 0, nullable: false })
  views: number;

  @Column("boolean", { name: "IsDisabled", default: false, nullable: false })
  isDisabled: boolean;

  @Column("varchar", { name: "Body", default: '', nullable: true })
  body: string;

  @Column("varchar", { name: "aiResponse", default: '', nullable: true })
  aiResponse: string;

  @Column("text", { name: "tts_text", nullable: true, default: '' })
  tts_text: string; // ← ADD THIS

  @Column("blob", { name: "I_image", nullable: true})
  i_image: Buffer;


  @ManyToOne(() => Thread, (thread) => thread.threadItems)
  thread: Thread;

  @OneToMany(
    () => ThreadItemPoint,
    (threadItemPoint) => threadItemPoint.threadItem
  )
  threadItemPoints: ThreadItemPoint[];

  @ManyToOne(() => User, (user) => user.threadItems)
  user: User;

  @Column("int", { name: "Points", default: 0, nullable: false })
  points: number;

  @Column("int", { name: "Rank_1", default: 0, nullable: true })
  rank_1: number;

  @Column("int", { name: "Rank_2", default: 0, nullable: true })
  rank_2: number;

  @Column("int", { name: "Rank_3", default: 0, nullable: true })
  rank_3: number;

  @Column("varchar", { name: "Field_1", length: 150, nullable: true})
  @Length(5, 150)
  field_1: string;

  @Column("varchar", { name: "Field_2", length: 150, nullable: true})
  @Length(5, 150)
  field_2: string;

  @Column("varchar", { name: "Field_3", length: 150, nullable: true})
  @Length(5, 150)
  field_3: string;

  @Column("blob", { name: "Image_1", nullable: true})
  image_1: Buffer;

  @Column("blob", { name: "Image_2", nullable: true})
  image_2: Buffer;


}

//   @Column("text", { nullable: true, default: '' })
    // userResponse: string;

    // @Column("text", { nullable: true, default: '' })
    // aiResponse: string;