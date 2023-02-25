import { ipcMain } from 'electron'

export function eventInit() {
  ipcMain.on("search-word", (_, word) => {
    
  })

  ipcMain.on("test", (_, data) => {
    console.log('ipcMain data: ', data);

  })
}