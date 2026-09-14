
import { Column, BaseEntity } from "typeorm";

export class Auditable extends BaseEntity {
  @Column("varchar", {
    name: "CreatedBy",
    length: 60,
    nullable: true,
  })
  createdBy: string;

  @Column("datetime", {
    name: "CreatedOn",
    default: () => "CURRENT_TIMESTAMP", // SQLite equivalent for current time
    nullable: false,
  })
  createdOn: Date;

  @Column("varchar", {
    name: "LastModifiedBy",
    length: 60,
    nullable: true,
  })
  lastModifiedBy: string;

  @Column("datetime", {
    name: "LastModifiedOn",
    default: () => "CURRENT_TIMESTAMP", // Use CURRENT_TIMESTAMP for last modified time
    nullable: false,
  })
  lastModifiedOn: Date;
}



// import { Column, BaseEntity } from "typeorm";

// export class Auditable extends BaseEntity {
//   @Column("varchar", {
//     name: "CreatedBy",
//     length: 60,
//     default: () => `getpgusername()`,
//     nullable: false,
//   })
//   createdBy: string;

//   @Column("timestamp with time zone", {
//     name: "CreatedOn",
//     default: () => `now()`,
//     nullable: false,
//   })
//   createdOn: Date;

//   @Column("varchar", {
//     name: "LastModifiedBy",
//     length: 60,
//     default: () => `getpgusername()`,
//     nullable: false,
//   })
//   lastModifiedBy: string;

//   @Column("timestamp with time zone", {
//     name: "LastModifiedOn",
//     default: () => `now()`,
//     nullable: false,
//   })
//   lastModifiedOn: Date;
// }