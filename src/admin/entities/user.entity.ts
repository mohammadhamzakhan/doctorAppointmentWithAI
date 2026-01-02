import { Exclude } from "class-transformer";

export class UserEntity {
    email: string
    @Exclude()
    password: string;

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }

}