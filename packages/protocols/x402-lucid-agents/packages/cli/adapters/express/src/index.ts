import { app } from './lib/agent';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting agent server on port ${port}...`);

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default server;
