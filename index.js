const db = require('./db');
const poll = require('./poll');

const sqlServerPool = db.sqlServerPool;

async function sync() {
    // await sqlServerPool.connect();
    await db.connectMongoDB();
    await poll.postFichada(
      {
        "agente" : {
            "_id" : "5e53f48ed40607323c624b8f"
        },
        "fecha" : "2013-09-27T14:06:46.000Z",
        "esEntrada" : false,
        "reloj" : 1,
        "format" : "RSI_DLF_IDENTITY_VERIFIED",
        "data1" : "0000001018",
        "data2" : "3"
    }
     )

    // let response = await fetch("/subscribe");
    // if (response.status == 502) {
    //     // Status 502 is a connection timeout error,
    //     // may happen when the connection was pending for too long,
    //     // and the remote server or a proxy closed it
    //     // let's reconnect
    //     await subscribe();
    // } else if (response.status != 200) {
    //     // An error - let's show it
    //     showMessage(response.statusText);
    //     // Reconnect in one second
    //     await new Promise(resolve => setTimeout(resolve, 1000));
    //     await subscribe();
    // } else {
    //   // Get and show the message
    //     let message = await response.text();
    //     showMessage(message);
    //     // Call subscribe() again to get the next message
    //     await subscribe();
    // }
}

sync();