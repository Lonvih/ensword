import { ipcMain } from 'electron'

let inited = false;
export function eventInit() {
  if (inited) return;
  inited = true;
  ipcMain.on("search-word", (_, word) => {
    
  })

  ipcMain.on("test", (_, data) => {
    console.log('ipcMain data: ', data);

  })
}