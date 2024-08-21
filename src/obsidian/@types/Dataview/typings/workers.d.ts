declare module "web-worker:*" {
  const WorkerFactory: new (options: unknown) => Worker;
  export default WorkerFactory;
}
