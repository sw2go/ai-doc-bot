import Layout from "@/components/layout";
import { UiContext } from "@/types/uiContext";
import { ChangeEvent, useEffect, useRef, useState } from "react";


export default function FilesPage() {
  const [files, setFileList] = useState<FileList | null>(null);
  const [uiContext, setUiContext] = useState<UiContext>( { readonly: [], editable: [], providerName: '', providerUrl: '' });
  const [contextName, setContextName] = useState<string>('');
  const [vectorCount, setVectorCount] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const secretRef = useRef<HTMLInputElement | null>(null);

  const namespaceSelectionChanged = async (e: ChangeEvent<HTMLSelectElement>) => {
    setContextName(e.target.value);
    await countVectors(e.target.value);    
  }

  const openFileSelectDialog = () => {
    inputRef.current?.click();
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

  const countVectors = async (contextName: string) => {
    const res = await fetch("/api/files", {
      method: "GET",
      headers: {
        'x-context-name': contextName
      },
    });
    const { data, error }: {
      data: {
        before: number;
        after: number;
      } | null;
      error: string | null;
    } = await res.json();

    if (error || !data) {
      alert(error || "Sorry! something went wrong.");
      return;
    } else {
      setVectorCount(data?.after as number);
    }
  }

  const addVectors = async (fileList: FileList) => {    
    try {

      let formData = new FormData();

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i) as File; 
        formData.append(`file${i}`, file)
      }

      const res = await fetch("/api/files", {
        method: "POST",
        headers: {
          'x-secret': secretRef.current?.value as string,
          'x-context-name': contextName
        },
        body: formData,
      });

      const { data, error }: {
        data: {
          before: number;
          after: number;
          files: string[];
        } | null;
        error: string | null;
      } = await res.json();
  
      if (error || !data) {
        alert(error || "Sorry! something went wrong.");
        return;
      }

      setVectorCount(data.after);
      alert(data.files);
  
      console.log("File was uploaded successfully:", data);
    } catch (error) {
      console.error(error);
      alert("Sorry! something went wrong.");
    }
  }

  const clearVectors = async () => {
    const res = await fetch("/api/files", {    
      method: "DELETE",
      headers: {
        'x-secret': secretRef.current?.value as string,
        'x-context-name': contextName
      }
    });

    const { data, error }: {
      data: {
        before: number;
        after: number;
        text: string;
      } | null;
      error: string | null;
    } = await res.json();

    if (error || !data) {
      alert(error || "Sorry! something went wrong.");
      return;
    } else {
      setVectorCount(data.after);
      alert(data.text);
    }
  }

  const getContexts = async () => {
    const res = await fetch("/api/contexts", {    
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return await res.json() as UiContext;
  }

  useEffect(() => { 
    countVectors(contextName); 
  }, [contextName]);

  useEffect(() => {   
    getContexts().then(result => {
      setUiContext(result);
      setContextName(result.readonly[0]);
    }); 
  }, []);

  return (
    <>
      <Layout>
      <div>        
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center mb-5">
            <select value={contextName} onChange={namespaceSelectionChanged}>
            {[...uiContext.readonly, ...uiContext.editable].map((namespace, index) => {
              return(
                      <option key={`option${index}`} value={namespace}>
                        {namespace}
                      </option>
                    );
              })}
            </select>
          </h1>
          <div className="text-center mb-10">
            The {contextName} vector store contains {vectorCount} text blocks
          </div>
          <div  style={ uiContext.readonly.some(item => item == contextName)  ? {} : { display: 'none' } }  className="text-center mb-10">
            Secret: <input ref={secretRef} name="file" type="password"/>
          </div>
          <div className="text-center mb-10">
            <form action="">
              <input ref={inputRef} name="file" type="file" multiple accept="application/pdf,text/plain" style={{ display: 'none' }} onChange={filesSelectionChanged} />
            </form>
            <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={openFileSelectDialog}>Add files to {contextName}</button>
          </div>
          <div className="text-center mb-10">
            <span className="bg-gray-200 hover:bg-gray-100 rounded p-2">
            <a href= {`api/files?context=${contextName}`} title="Down"   >Download Config</a>
            </span>            
          </div>
          <div className="text-center ">
            <button className="bg-gray-200 hover:bg-gray-100 rounded p-2" onClick={clearVectors}>Clear {contextName}</button>
          </div>
        </div>
      </div>
      </Layout>
    </>
  );

}