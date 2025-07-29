import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export function TestDropzone() {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('Test dropzone - files dropped:', acceptedFiles);
    setFiles(acceptedFiles);
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    }
  });

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium mb-4">Test Dropzone</h3>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragAccept 
            ? 'border-green-500 bg-green-50' 
            : isDragReject
            ? 'border-red-500 bg-red-50'
            : isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <p>
          {isDragActive 
            ? 'Drop the files here...' 
            : 'Drag and drop some files here, or click to select files'}
        </p>
      </div>
      
      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium">Files:</h4>
          <ul>
            {files.map(file => (
              <li key={file.name}>{file.name} - {file.size} bytes</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}