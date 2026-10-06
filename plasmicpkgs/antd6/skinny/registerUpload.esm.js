import { Upload, Image } from 'antd';
import React, { useRef, useState, useMemo } from 'react';
import { r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

function getThumbUrl(file) {
  if (!file?.type?.startsWith("image")) {
    return void 0;
  }
  return `data:${file.type};base64,${file.contents}`;
}
function UploadWrapper(props) {
  const { files, dragAndDropFiles, onFilesChange, maxCount, ...rest } = props;
  const filesRef = useRef();
  filesRef.current = files;
  const changeFiles = (next) => {
    filesRef.current = next;
    onFilesChange?.(next);
  };
  const [previewFileId, setPreviewFileId] = useState();
  const [previewOpen, setPreviewOpen] = useState(false);
  const handleChange = (info) => {
    const { file } = info;
    if (file.status === "removed") {
      return;
    }
    const metadata = {
      uid: file.uid,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
    changeFiles(
      [
        ...(filesRef.current ?? []).filter((f) => f.uid !== file.uid),
        {
          ...metadata,
          status: "uploading"
        }
      ].slice(maxCount && maxCount > 0 ? -maxCount : 0)
    );
    const reader = new FileReader();
    reader.onload = () => {
      if (!filesRef.current?.map((f) => f.uid).includes(metadata.uid)) {
        return;
      }
      changeFiles(
        (filesRef.current ?? []).map(
          (f) => f.uid === metadata.uid ? {
            ...metadata,
            contents: reader.result.replace(
              /^data:[^;]+;base64,/,
              ""
            ),
            status: "done"
          } : f
        )
      );
    };
    reader.onerror = () => {
      if (!filesRef.current?.map((f) => f.uid).includes(metadata.uid)) {
        return;
      }
      changeFiles(
        (filesRef.current ?? []).map(
          (f) => f.uid === metadata.uid ? {
            ...metadata,
            status: "error"
          } : f
        )
      );
    };
    reader.readAsDataURL(info.file);
  };
  const handleRemove = (file) => {
    changeFiles(
      (filesRef.current ?? []).filter((f) => f.uid !== file.uid)
    );
  };
  const handlePreview = async (file) => {
    setPreviewFileId(files?.filter((f) => file.uid === f.uid)[0]?.uid);
    setPreviewOpen(true);
  };
  const handleCancel = () => setPreviewFileId(void 0);
  const previewFile = useMemo(
    () => files?.filter((f) => previewFileId === f.uid)[0],
    [files, previewFileId]
  );
  const UploadComponent = useMemo(
    () => dragAndDropFiles ? Upload.Dragger : Upload,
    [dragAndDropFiles]
  );
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    UploadComponent,
    {
      ...rest,
      fileList: files?.map((f) => ({
        ...f,
        thumbUrl: getThumbUrl(f)
      })),
      onPreview: handlePreview,
      beforeUpload: () => {
        return false;
      },
      onChange: (info) => {
        handleChange(info);
      },
      onRemove: (file) => {
        handleRemove(file);
      }
    }
  ), previewFile && /* @__PURE__ */ React.createElement(
    Image,
    {
      wrapperStyle: { display: "none" },
      preview: {
        visible: previewOpen,
        onVisibleChange: (visible) => setPreviewOpen(visible),
        afterOpenChange: (visible) => !visible && handleCancel()
      },
      alt: previewFile?.name,
      src: getThumbUrl(previewFile)
    }
  ));
}
UploadWrapper.__plasmicFormFieldMeta = {
  valueProp: "files",
  onChangeProp: "onFilesChange"
};
function registerUpload(loader) {
  registerComponentHelper(loader, UploadWrapper, {
    name: "plasmic-antd6-upload",
    displayName: "Upload",
    description: "Select files and read their contents locally as base64. A done status means local reading is complete; this component does not upload to a server.",
    props: {
      accept: {
        type: "choice",
        displayName: "Allowed types",
        options: [
          {
            value: "",
            label: "Any kind of file"
          },
          {
            value: "image/*",
            label: "Image"
          },
          {
            value: "video/*",
            label: "Video"
          },
          {
            value: "audio/*",
            label: "Audio"
          },
          {
            value: "application/pdf",
            label: "PDF"
          }
        ],
        defaultValue: ""
      },
      listType: {
        type: "choice",
        options: ["text", "picture", "picture-card", "picture-circle"],
        defaultValueHint: "text"
      },
      dragAndDropFiles: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: "You can drag files to a specific area, to upload. Alternatively, you can also upload by selecting."
      },
      multiple: {
        type: "boolean",
        advanced: true,
        defaultValueHint: false,
        description: "Upload several files at once in modern browsers"
      },
      files: {
        type: "object",
        displayName: "Files",
        defaultValue: [],
        hidden: (ps) => !!ps.__plasmicFormField
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-button",
            props: {
              children: {
                type: "text",
                value: "Upload"
              }
            }
          }
        ]
      },
      maxCount: {
        type: "number",
        displayName: "Limit of files",
        advanced: true
      },
      onFilesChange: {
        type: "eventHandler",
        displayName: "On files change",
        argTypes: [
          {
            name: "files",
            type: "array"
          }
        ]
      },
      showUploadList: {
        type: "boolean",
        displayName: "List files",
        defaultValue: true
      }
    },
    states: {
      files: {
        type: "writable",
        valueProp: "files",
        variableType: "array",
        onChangeProp: "onFilesChange",
        hidden: (ps) => !!ps.__plasmicFormField
      }
    },
    ...{ trapsSelection: true },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerUpload",
    importName: "UploadWrapper"
  });
}

export { UploadWrapper, registerUpload };
//# sourceMappingURL=registerUpload.esm.js.map
