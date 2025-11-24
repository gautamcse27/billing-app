// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("billingAPI", {
  ping: () => ipcRenderer.invoke("ping"),

  createInvoice: (invoice) => ipcRenderer.invoke("invoice:create", invoice),
  listInvoices: () => ipcRenderer.invoke("invoice:list"),
  getInvoice: (id) => ipcRenderer.invoke("invoice:get", id),

  updateInvoice: (payload) => ipcRenderer.invoke("invoice:update", payload),
  deleteInvoice: (id) => ipcRenderer.invoke("invoice:delete", id),
});
