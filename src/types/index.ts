export enum Role{
    ADMIN = 'ADMIN',
    USER = 'USER',
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}