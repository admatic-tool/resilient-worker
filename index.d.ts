interface document {
  [ key:string ] : any
}

declare namespace WorkerFactory {
  interface ConsumerMeta {
    name: string
    queue: string
    max_try?: number
    retry_timeout?: number
    callback(doc : document): Promise<any>
    failCallback?(doc : document): Promise<any>
    successCallback?(doc : document): Promise<any> 
  }

  interface PublisherMeta {
    name: string
    publishIn: {
      routingKey: string
      exchange: string
    }
  }

  interface Meta extends ConsumerMeta, PublisherMeta {

  }

  interface Worker {
    start(): Promise<void>
  }

  type Publish = (doc : document, executionId? : string ) => Promise<boolean>

  function createWorker(
    meta: ConsumerMeta
  ): {
    worker: Worker
  }
  
  function createWorker(
    meta: PublisherMeta
  ): {
    publish: Publish
  }
  
  function createWorker(
    meta: Meta
  ) : {
    worker: Worker
    publish: Publish
  }
}



export as namespace WorkerFactory