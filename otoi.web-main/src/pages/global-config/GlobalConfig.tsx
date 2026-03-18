import { KeenIcon } from "@/components"
import React, { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getGlobalAssets, updateGlobalAssets } from "./services/businessConfig.service"
import { resolveImageUrl } from "@/utils/imageUtils"

interface UploadCardProps {
  title: string
  desc: string
  file: File | null
  onFileChange: (file: File | null) => void
  existingUrl?: string
}

const MAX_FILE_SIZE_KB = 150;

const UploadCard: React.FC<UploadCardProps> = ({ title, desc, file, onFileChange, existingUrl }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [file])

  const validateAndUpload = (selectedFile: File) => {
    const fileSizeKB = selectedFile.size / 1024;
    if (fileSizeKB > MAX_FILE_SIZE_KB) {
      toast.error(
        `File is too large (${fileSizeKB.toFixed(
          1,
        )}KB). Max limit is ${MAX_FILE_SIZE_KB}KB.`,
      )
      return;
    }
    onFileChange(selectedFile);
  }

  const handleUploadClick = () => inputRef.current?.click()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) validateAndUpload(selectedFile);
    if (inputRef.current) inputRef.current.value = ""; // Reset input
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const extension = droppedFile?.name.split('.').pop()?.toLowerCase();
    
    if (droppedFile && extension && allowedExtensions.includes(extension)) {
      validateAndUpload(droppedFile);
    } else {
      toast.error("Invalid file type. Only JPG, JPEG, and PNG are allowed.");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex-1 flex flex-col shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
        </div>
        
        <div className="relative group ml-2">
          <div className="bg-amber-50 text-amber-600 p-1.5 rounded-full animate-pulse cursor-help">
            <KeenIcon icon="information-2" className="text-lg" />
          </div>
          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl z-10">
            For faster PDF generation and smaller file sizes, we recommend images under 150KB.
            <div className="absolute top-full right-3 border-8 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      </div>

      {/* Interactive Upload Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={!previewUrl ? handleUploadClick : undefined}
        className={`relative flex flex-col items-center justify-center min-h-[200px] rounded-xl border-2 border-dashed transition-all duration-200 
          ${isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.02]" : ""}
          ${previewUrl || existingUrl
            ? "border-slate-100 bg-slate-50/30" 
            : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer"
          }`}
      >
        {previewUrl || existingUrl ? (
          <div className="p-4 w-full h-full flex flex-col items-center justify-center">
            <img
              src={previewUrl || existingUrl}
              alt="Preview"
              className="max-h-[140px] w-auto object-contain drop-shadow-md rounded"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 mb-3 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <KeenIcon icon="picture" className="text-xl" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Drop image here</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold tracking-widest">PNG, JPG, JPEG up to {MAX_FILE_SIZE_KB}KB</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input ref={inputRef} type="file" accept=".jpg, .jpeg, .png" className="hidden" onChange={handleFileChange} />
        
        <button
          onClick={handleUploadClick}
          className="flex-1 bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <KeenIcon icon="cloud-add" className="text-xs" />
          {file ? "Replace" : "Upload Image"}
        </button>

        {file && (
          <button
            onClick={() => { onFileChange(null); if(inputRef.current) inputRef.current.value=""; }}
            className="group px-3 py-2.5 border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-100 transition-colors"
            title="Delete"
          >
            <KeenIcon icon="trash" className="text-slate-400 group-hover:text-red-500" />
          </button>
        )}
      </div>
    </div>
  )
}

const GlobalConfig = () => {
  const [siteLogoFile, setSiteLogoFile] = useState<File | null>(null)
  const [esignFile, setEsignFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [existingAssets, setExistingAssets] = useState<{logo_path?: string, esign_path?: string}>({})

  useEffect(() => {
    const fetchAssets = async () => {
      const response = await getGlobalAssets()
      if (response.success && response.data) {
        setExistingAssets(response.data)
      }
    }
    fetchAssets()
  }, [])



  const handleSave = async () => {
    if (!siteLogoFile && !esignFile) {
      toast.error("Please select at least one image to save.")
      return
    }

    setIsSaving(true)
    try {
      const formData = new FormData()
      
      if (siteLogoFile) {
        formData.append("logo", siteLogoFile)
      }
      
      if (esignFile) {
        formData.append("esign", esignFile)
      }

      const response = await updateGlobalAssets(formData)
      
      if (response.success) {
        toast.success("Global assets updated successfully!")
        setSiteLogoFile(null)
        setEsignFile(null)
        // Refresh existing assets
        const refreshResponse = await getGlobalAssets()
        if (refreshResponse.success) setExistingAssets(refreshResponse.data)
      } else {
        toast.error(response.error || "Failed to update assets")
      }
    } catch (error) {
           toast.error("An error occurred while saving assets.")
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <div className="p-6 md:p-12 bg-[#F8FAFC] min-h-screen font-sans relative overflow-hidden">

      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">General Assets</h1>
          <p className="text-slate-500 text-sm">
            Manage the brand images used across the platform.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-stretch">
          <UploadCard
            title="Site Logo"
            desc="Appears in quotation/invoice headers and receipts."
            file={siteLogoFile}
            onFileChange={setSiteLogoFile}
            // Add a cache breaker to ensure fresh image is fetched
            // We use replace('/api', '') because VITE_APP_API_URL usually includes /api
            existingUrl={existingAssets.logo_path ? `${resolveImageUrl(`/static/uploads/business/${existingAssets.logo_path}`)}?t=${Date.now()}` : undefined}
          />

          <UploadCard
            title="eSign Image"
            desc="Official signature used in PDF receipts."
            file={esignFile}
            onFileChange={setEsignFile}
            existingUrl={existingAssets.esign_path ? `${resolveImageUrl(`/static/uploads/business/${existingAssets.esign_path}`)}?t=${Date.now()}` : undefined}
          />
        </div>

        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-t border-slate-200">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-widest">
            {/* Identity Configuration v1.0 */}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (!siteLogoFile && !esignFile)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-bold text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GlobalConfig