import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Length } from "class-validator";
import { Thread } from "./Thread";
import { ThreadPoint } from "./ThreadPoint";
import { ThreadItemPoint } from "./ThreadItemPoint";
import { Auditable } from "./Auditable";
import { ThreadItem } from "./ThreadItem";
// import { ByteRange } from "express-serve-static-core";

@Entity({ name: "Users" })
export class User extends Auditable {
  @PrimaryGeneratedColumn("increment", { name: "Id" })
  id: number;

  // @PrimaryGeneratedColumn ({ name: "Id", type: "bigint" })
  // id: string;

  @Column("varchar", {
    name: "Email",
    length: 120,
    unique: true,
    nullable: false,
  })
  email: string;

  @Column("varchar", {
    name: "UserName",
    length: 60,
    unique: true,
    nullable: false,
  })
  userName: string;

  @Column("varchar", { name: "Password", length: 100, nullable: false })
  @Length(8, 100)
  password: string;

  @Column("boolean", { name: "Confirmed", default: false, nullable: false })
  confirmed: boolean;

  @Column("varchar", { name: "Bio", default: '', nullable: true })
  bio: string;

  // @Column("varchar", { name: "Bio", length: 20000, nullable: true })
  // @Length(8, 20000)
  // bio: string;

  @Column("varchar", { name: "Language", length: 100, nullable: true })
  @Length(8, 100)
  language: string;

  @Column("int", { name: "Birth_year", default:0, nullable: true })
  birth_year: number;

  @Column("blob", { name: "U_image", nullable: true})
  u_image: Buffer;

  // @Column("bytea", { name: "U_image", nullable: true})
  // u_image: Buffer;

  @Column("boolean", { name: "IsDisabled", default: false, nullable: false })
  isDisabled: boolean;

  @OneToMany(() => Thread, (thread) => thread.user)
  threads: Thread[];

  @OneToMany(() => ThreadPoint, (threadPoint) => threadPoint.user)
  threadPoints: ThreadPoint[];

  @OneToMany(() => ThreadItemPoint, (threadItemPoint) => threadItemPoint.user)
  threadItemPoints: ThreadItemPoint[];

  @OneToMany(() => ThreadItem, (threadItem) => threadItem.user)
  threadItems: ThreadItem[];

  @Column("int", { name: "Rank_1", default: 0, nullable: true })
  rank_1: number;

  @Column("int", { name: "Rank_2", default: 0, nullable: true })
  rank_2: number;

  @Column("varchar", { name: "Field_1", length: 150, nullable: true})
  @Length(5, 150)
  field_1: string;

  @Column("varchar", { name: "Field_2", length: 150, nullable: true})
  @Length(5, 150)
  field_2: string;

  @Column("blob", { name: "Image_1", nullable: true})
  image_1: Buffer;

  // @Column("bytea", { name: "Image_1", nullable: true})
  // image_1: Buffer;

  @Column("int", { name: "Rank_3", default: 0, nullable: true })
  rank_3: number;

  @Column("int", { name: "Rank_4", default: 0, nullable: true })
  rank_4: number;

  @Column("int", { name: "Rank_5", default: 0, nullable: true })
  rank_5: number;

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

  // @Column("int", { name: "Points", default: 0, nullable: false })
  // points: number;

    //   @Column("text", { nullable: true, default: '' })
    // userResponse: string;

    // @Column("text", { nullable: true, default: '' })
    // aiResponse: string;