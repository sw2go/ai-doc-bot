import Layout from "@/components/layout";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { API_URL } from "@/config/buildtimeSettings";
import { ContextInfo, OneTimeKey, VectorInfo } from "@/types/api";


export default function FilesPage() {
  const [files, setFileList] = useState<FileList | null>(null);
  const [uiContext, setUiContext] = useState<ContextInfo[]>([]);
  const [contextName, setContextName] = useState<string>('');
  const [vectorCount, setVectorCount] = useState<number>(0);
  const [oneTimeKey, setOneTimeKey] = useState<string>('');

  const inputDocFilesRef = useRef<HTMLInputElement | null>(null);
  const inputConfigFileRef = useRef<HTMLInputElement | null>(null);
  const secretRef = useRef<HTMLInputElement | null>(null);
  const deleteRef = useRef<HTMLInputElement | null>(null);
  const logDownloadRef = useRef<HTMLAnchorElement | null>(null);

  const namespaceSelectionChanged = async (e: ChangeEvent<HTMLSelectElement>) => {
    setContextName(e.target.value);
    await countVectors(e.target.value);    
  }

  const openDocFilesSelectDialog = () => {
    inputDocFilesRef.current?.click();
  }

  const openConfigFileSelectDialog = () => {
    inputConfigFileRef.current?.click();
  }

  const filesSelectionChanged = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target.files;
    if (fileInput && fileInput.length > 0) {
      /** Setting file state */
      setFileList(fileInput); // we will use the file state, to send it later to the server

      /** immediately upload*/
      await addVectors(fileInput);

      // reset current file input value to allow upload of same file again
      e.target.value = '';
    }
  }  

  const filesSelectionChanged2 = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target.files;
    if (fileInput && fileInput.length > 0) {
      setFileList(fileInput); 
      /** immediately upload*/
      await updateContextConfigFile(fileInput);
      // reset current file input value to allow upload of same file again
      e.target.value = '';
    }
  }  

  const countVectors = async (contextName: string) => {
    if (contextName?.length > 0) {
      const res = await fetch(`${API_URL}/contexts/${contextName}/vectors`, {
        method: "GET"
      });

      if (res.ok) {
        const info: VectorInfo = await res.json();
        setVectorCount(info.vectorCount);
        return;
      } else {
        const { error } = await res.json();
        console.log(error);
        alert(error);
      }

    } else {
      setVectorCount(0);
    }
  }

  const addVectors = async (fileList: FileList) => {    
    try {

      let formData = new FormData();

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i) as File; 
        formData.append(`file${i}`, file)
      }

      const res = await fetch(`${API_URL}/contexts/${contextName}/vectors`, {
        method: "POST",
        headers: {
          'x-secret': secretRef.current?.value as string
        },
        body: formData,
      });

      if (res.ok) {
        const info: VectorInfo = await res.json();
        setVectorCount(info.vectorCount);        
        alert(`${info.change} vectors(s) added`);
      } else {
        const { error } = await res.json();
        console.log(error);
        alert(error);
      }
    } catch (error: any) {
      console.error(error.message);
      alert("Sorry! something went wrong.");
    }
  }

  const clearVectors = async () => {
    try {
      const res = await fetch(`${API_URL}/contexts/${contextName}/vectors`, {    
        method: "DELETE",
        headers: {
          'x-secret': secretRef.current?.value as string
        }
      });
  
      if (res.ok) {
        const info: VectorInfo = await res.json();
        setVectorCount(info.vectorCount);
        alert(`${-info.change} vectors(s) deleted`);
      } else {
        const { error } = await res.json();
        console.log(error);
        alert(error);
      }
    } catch (error) {
      console.error(error);
      alert("Sorry! something went wrong.");
    }
  }

  const updateContextConfigFile = async (fileList: FileList) => {
    try {
      let formData = new FormData();

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i) as File; 
        formData.append(`file${i}`, file)
      }

      const res = await fetch(`${API_URL}/contexts/${contextName}`, {
        method: "PUT",
        headers: {
          'x-secret': secretRef.current?.value as string
        },
        body: formData,
      });

      if (res.ok) {
        alert("Config updated");
      } else {
        const { error } = await res.json();
        console.log(error);
        alert(error);
      }           
    } catch(error) {
      console.log(error);
      alert(error);
    }
  }

  const addNewContext = async () => {
    try {
      const res = await fetch(`${API_URL}/contexts`, {
        method: "POST",
        headers: {
          'content-type': 'application/json',
          'x-secret': secretRef.current?.value as string
          
        },
        body: JSON.stringify({
          name: deleteRef.current?.value as string,
          mode: 'OpenAI-QA'
        })
      });

      if (res.ok) {
        updateContextDropdown();
        alert("Context added");
      } else {
        const { error } = await res.json();
        console.log(error);
        alert(error);
      }      
    } catch(error) {
      console.log(error);
      alert(error);
    }
  }

  const deleteContextConfigFile = async () => {
    try {
      const res = (deleteRef.current?.value == '*')
      ? await fetch(`${API_URL}/contexts?type=2`, {
        method: "DELETE",
        headers: {
          'x-secret': secretRef.current?.value as string
        }
      })
      : await fetch(`${API_URL}/contexts/${deleteRef.current?.value}`, {
        method: "DELETE",
        headers: {
          'x-secret': secretRef.current?.value as string
        }
      });

      if (res.ok) {
        updateContextDropdown();
        alert("Context deleted");
      } else {
        const { error } = await res.json();
        console.log(error);
        alert(error);
      }          
    } catch(error) {
      console.log(error);
      alert(error);
    }
  }

  const getContexts = async () => {
    const res = await fetch(`${API_URL}/contexts`, {    
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      return await res.json() as ContextInfo[];
    } else {
      alert( JSON.stringify( await res.json()) )
      return [];
    }
  }

  const downLoadLog = async () => {
    const res = await fetch(`${API_URL}/logs`, {    
      method: "POST",
      headers: {
        'x-secret': secretRef.current?.value as string
      }
    });

    if (res.ok) {
      const otk = await res.json() as OneTimeKey;
      setOneTimeKey(otk.key);
      setTimeout(() => logDownloadRef.current?.click(), 0);
    } else {
      alert( JSON.stringify( await res.json()) )
    }
  }

  useEffect(() => { 
    countVectors(contextName); 
  }, [contextName]);

  useEffect(() => {  
    updateContextDropdown(); 
  }, []);

  const updateContextDropdown = () => {   
    getContexts().then(result => {
      setUiContext(result);
      if (result.length > 0) {
        setContextName(result[0].name);
      }      
    }) 
  }

  return (
    <>
      <Layout>
      <div>        
        <div className="flex flex-col">
          <div className="">
            <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center mb-5">
              <select value={contextName} onChange={namespaceSelectionChanged}>
              {uiContext.map((context, index) => {
                return(
                        <option key={`option${index}`} value={context.name}>
                          {context.name}
                        </option>
                      );
                })}
              </select>
            </h1>
            <div className="text-center mb-10">
              The {contextName} vector store contains {vectorCount} text blocks
            </div>
            <div  style={ uiContext.some(item => item.type == 1 && item.name == contextName)  ? {} : { display: 'none' } }  className="text-center mb-10">
              Secret<input className="border-solid border-2 ml-2" ref={secretRef} name="file" type="password"/>
            </div>
          </div>
          <div className="flex justify-center gap-5">
            <div className="text-center">
              <form action="">
                <input ref={inputDocFilesRef} name="file" type="file" multiple accept="application/pdf,text/plain" style={{ display: 'none' }} onChange={filesSelectionChanged} />
              </form>
              <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={openDocFilesSelectDialog}>Add files to {contextName}</button>
            </div>
            <div className="text-center" >
              <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={clearVectors}>Clear {contextName}</button>
            </div>
          </div>
          <div className="flex justify-center gap-5 mt-10">
            <div className="text-center">
              <form action="">
                <input ref={inputConfigFileRef} name="file" type="file" multiple accept="text/plain" style={{ display: 'none' }} onChange={filesSelectionChanged2} />
              </form>
              <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={openConfigFileSelectDialog}>Upload Config</button>
            </div>
            <div className="text-center">
              <div className="bg-gray-200 hover:bg-gray-100 rounded p-2">
              <a href= {`${API_URL}/contexts/${contextName}`} title="Down">Download Config</a>
              </div>            
            </div>
          </div>
          <div className="flex justify-center gap-5 mt-10">
            <div className="text-center pt-2">
              Context<input className="border-solid ml-2 border-2" ref={deleteRef} name="file"/>
            </div>
            <div className="text-center">
              <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={addNewContext}>Add</button>
            </div>
            <div className="text-center">
              <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={deleteContextConfigFile}>Delete</button>
            </div>
          </div>
          <div className="flex justify-center gap-5 mt-10">
          <div className="text-center">
              <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={downLoadLog}>Download Log</button>
              <a ref={logDownloadRef} style={{ display: 'none' }} href= {`${API_URL}/logs?key=${oneTimeKey}`} title="Down">Download Log</a>
            </div>
          </div>
        </div>
      </div>
      </Layout>
    </>
  );

}