import {empty} from './model.js';
console.log("insert into public.households(document) values ('"+JSON.stringify(empty()).replaceAll("'","''")+"'::jsonb) returning id;");
