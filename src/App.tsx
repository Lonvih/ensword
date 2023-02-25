//
import { useEffect, useState } from "react";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import { message, Upload, Button } from "antd";
import "./App.scss";
import { ipcRenderer } from "electron";

const { Dragger } = Upload;

interface DictFile {
  name: string;
  path: string;
  uid?: string;
}

console.log(
  "[App.tsx]",
  `Hello world from Electron ${process.versions.electron}!`
);

ipcRenderer.on("search-word", (_, data) => {
  console.log("search-word: ", data);
  (window as any).jQuery("#dict").empty().html(data);
});

function App() {
  const [fileList, setFileList] = useState<any>([]);
  const [word, setWord] = useState("");

  useEffect(() => {
    const cachedFiles = window.localStorage.getItem('__files__')
    if (cachedFiles) {
      setFileList(JSON.parse(cachedFiles))
    }
  }, []);

  function saveFilesInCache(files: DictFile[]) {
    const newFiles = files.map((f) => ({
      uid: f.uid,
      name: f.name,
      path: f.path,
    }));
    window.localStorage.setItem("__files__", JSON.stringify(newFiles));
  }

  function loadYouTuBe() {
    if (!fileList.length) {
      message.error("Please load mdict files first.")
      return;
    }
    ipcRenderer.send("loadYouTuBe", fileList)
  }

  const props: UploadProps = {
    name: "file",
    multiple: true,
    fileList,
    accept: ".mdd,.mdx",
    showUploadList: false,
    beforeUpload(file, files) {
      saveFilesInCache(files)
      setFileList(files);
      return false;
    },
  };

  return (
    <div className="App">
      <Dragger {...props}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag mdx and mdd file to this area, dict file will be parsed.
        </p>
        <p className="ant-upload-hint">
          Recommend both file, but mdd is optional, mdd is the file with audio
          and style, etc.
        </p>
      </Dragger>
      <div className="files">
        {fileList.map((file: DictFile) => {
          return (
            <div className="file" key={file.path}>
              <span className="file_name">{file.name}: </span>
              <span className="file_path">{file.path}</span>
            </div>
          );
        })}
      </div>
      <Button
        disabled={!fileList.length}
        className="start-button"
        type="dashed"
        size="large"
        onClick={loadYouTuBe}
      >
        Load YouTuBe Now
      </Button>
    </div>
  );
}

export default App;
