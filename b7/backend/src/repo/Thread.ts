import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany
} from "typeorm";
import { Length } from "class-validator";
import { User } from "./User";
import { ThreadItem } from "./ThreadItem";
import { ThreadPoint } from "./ThreadPoint";
import { ThreadCategory } from "./ThreadCategory";
import { Auditable } from "./Auditable";

@Entity({ name: "Threads" })
export class Thread extends Auditable {
  @PrimaryGeneratedColumn("increment", { name: "Id" })
  id: number;

  @Column("int", { name: "Views", default: 0, nullable: false })
  views: number;

  @Column("boolean", { name: "IsDisabled", default: false, nullable: false })
  isDisabled: boolean;

  @Column("varchar", { name: "Title", length: 150, nullable: false })
  @Length(5, 150)
  title: string;

  @Column("varchar", { name: "Body", length: 2500, nullable: true })
  @Length(10, 2500)
  body: string;

  @Column("blob", { name: "T_image", nullable: true})
  t_image: Buffer;

  @ManyToOne(() => User, (user: User) => user.threads)
  user: User;

  @OneToMany(() => ThreadItem, (threadItems) => threadItems.thread)
  threadItems: ThreadItem[];

  @OneToMany(() => ThreadPoint, (threadPoint) => threadPoint.thread)
  threadPoints: ThreadPoint[];

  @ManyToOne(() => ThreadCategory, (threadCategory) => threadCategory.threads)
  category: ThreadCategory;

  @Column("int", { name: "Points", default: 0, nullable: false })
  points: number;

  @Column("int", { name: "Rank_1", default: 0, nullable: true })
  rank_1: number;

  @Column("int", { name: "Rank_2", default: 0, nullable: true })
  rank_2: number;

  @Column("int", { name: "Rank_3", default: 0, nullable: true })
  rank_3: number;

  @Column("int", { name: "Rank_4", default: 0, nullable: true })
  rank_4: number;

  @Column("int", { name: "Rank_5", default: 0, nullable: true })
  rank_5: number;

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

  @Column("int", { name: "Rank_6", default: 0, nullable: true })
  rank_6: number;

  @Column("int", { name: "Rank_7", default: 0, nullable: true })
  rank_7: number;

  @Column("int", { name: "Rank_8", default: 0, nullable: true })
  rank_8: number;

  @Column("int", { name: "Rank_9", default: 0, nullable: true })
  rank_9: number;

  @Column("int", { name: "Rank_10", default: 0, nullable: true })
  rank_10: number;


}

//   @Column("text", { nullable: true, default: '' })
    // userResponse: string;

    // @Column("text", { nullable: true, default: '' })
    // aiResponse: string;