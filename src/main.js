const { app, BrowserWindow, Tray, Menu } = require('electron')
const path = require('path')
const url = require('url')

const TRAY_ARROW_HEIGHT = 10
const WINDOW_WIDTH = 400
const WINDOW_HEIGTH = 600

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let screen
let navWin
let trayWin
let tray

function createTray () {
  if (tray) return
  tray = new Tray(`${__dirname}/img/icon.png_16x16.png`)
  tray.on('click', () => {
    const cursorPosition = screen.getCursorScreenPoint()
    trayWin.setPosition(cursorPosition.x - WINDOW_WIDTH / 2, TRAY_ARROW_HEIGHT)

    trayWin.show()
    trayWin.focus()
  })
  tray.on('right-click', () => {
    tray.contextMenu.popup()
  })

  tray.contextMenu = Menu.buildFromTemplate([
    {
      label: 'Relatório',
      click: (item, win, event) => {
        navWin.openReport()
        navWin.show()
      }
    },
    {
      label: 'Configurar',
      click: (item, win, event) => {
        navWin.openConfig()
        navWin.show()
      }
    },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ])
  tray.setToolTip('This is my application.')
  // tray.setContextMenu(contextMenu)
}

function createTrackerWindow () {
  trayWin = trayWin || createWindow({
    file: 'tracker.html',
    win: {
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGTH,
      show: false,
      transparent: true,
      toolbar: false,
      frame: false,
      alwaysOnTop: true
    }
  })
  trayWin.on('blur', () => {
    trayWin.hide()
  })
  trayWin.webContents.openDevTools()
}

const defaultOpt = { file: 'index.html', win: { width: 800, height: 600, show: false } }

function createWindow (options = {}) {
  options = Object.assign({}, defaultOpt, options)
  // Create the browser window.
  let win = new BrowserWindow(Object.assign({}, { width: 800, height: 600, icon: `${__dirname}/img/icon.icns` }, options.win))

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, '..', 'public', options.file),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })

  if (options.methods) {
    Object.keys(options.methods).forEach((method) => {
      win[method] = options.methods[method]
    })
  }

  return win
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  screen = require('electron').screen
  createTrackerWindow()
  createTray()
  navWin = navWin || createWindow({
    methods: {
      openConfig: () => {
        navWin.loadURL(url.format({
          pathname: path.join(__dirname, '..', 'public', 'index.html'),
          protocol: 'file:',
          slashes: true
        }))
      },
      openReport: () => {
        navWin.loadURL(url.format({
          pathname: path.join(__dirname, '..', 'public', 'logado.html'),
          protocol: 'file:',
          slashes: true
        }))
      }
    }
  })
  // reportWin.show()
  // reportWin.webContents.openDevTools()
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (navWin === null) {
    navWin = navWin || createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

require('child_process').spawn('node', [`${__dirname}/backend/index.js`])