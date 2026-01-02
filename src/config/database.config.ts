import { registerAs } from "@nestjs/config";

export default registerAs('database', ()=>({
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/mydb',
}))