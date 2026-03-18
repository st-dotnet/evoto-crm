import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { KeenIcon } from "@/components";
import { toast } from "sonner";
import { resolveImageUrl } from "@/utils/imageUtils";

interface IProductImagesProps {
  formik: any;
}

const ProductImages = ({ formik }: IProductImagesProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const images = formik.values.images || [];

  const handleUploadClick = () => {
    if (images.length >= 4) {
      toast.error("You can only upload a maximum of 4 images.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentImageCount = images.length;
    const remainingSlots = 4 - currentImageCount;

    if (remainingSlots <= 0) {
      toast.error("You have already reached the maximum limit of 4 images.");
      event.target.value = '';
      return;
    }

    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const fileList = Array.from(files).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isAllowed = ext && allowedExtensions.includes(ext);
      if (!isAllowed) {
        toast.error(`File ${file.name} is not a supported image format. Only JPG, JPEG, and PNG are allowed.`);
      }
      return isAllowed;
    });

    if (fileList.length === 0) {
      event.target.value = '';
      return;
    }

    // Notify user if they selected more than they can upload
    if (fileList.length > remainingSlots) {
      toast.warning(`Only the first ${remainingSlots} image(s) will be uploaded to stay within the 4-image limit.`);
    }

    const filesToUpload = fileList.slice(0, remainingSlots);

    const uploadPromises = filesToUpload.map(file => {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Max size is 5MB.`);
        return null;
      }

      return {
        url: URL.createObjectURL(file), // Local preview URL
        file: file, // Store the actual File object for upload
        name: file.name,
        size: file.size,
        id: Date.now() + Math.random(),
        is_main: false
      };
    });

    const newValidImages = uploadPromises.filter(img => img !== null);

    if (newValidImages.length > 0) {
      const updatedImages = [...images, ...newValidImages];
      // If this is the first image added, make it main
      if (images.length === 0 && updatedImages.length > 0) {
        updatedImages[0].is_main = true;
      }
      formik.setFieldValue('images', updatedImages);
      toast.success(`Successfully added ${newValidImages.length} image(s)`);
    }

    // Reset input so the same file can be uploaded again if deleted
    event.target.value = '';
  };


  const handleDeleteImage = (index: number) => {
    const newImages = [...images];
    const wasMain = newImages[index].is_main;
    newImages.splice(index, 1);

    // If we deleted the feature image, make the first one main if any are left
    if (wasMain && newImages.length > 0) {
      newImages[0].is_main = true;
    }

    formik.setFieldValue('images', newImages);
    toast.success("Image removed");
  };

  const handleSetMainImage = (index: number) => {
    const newImages = images.map((img: any, i: number) => ({
      ...img,
      is_main: i === index
    }));
    formik.setFieldValue('images', newImages);
    toast.success("Feature image updated");
  };

  return (
    <div className="space-y-6 md:space-y-8 p-1 animate-in fade-in duration-500">
      {/* Hidden File Input */}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Product Images ({images.length}/4)</h2>
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
            Upload and manage high-quality photos (max 4) to showcase your product. First image will be used as the primary display.
          </p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".jpg, .jpeg, .png"
          multiple
          className="hidden"
        />
        {/* <Button
          type="button"
          onClick={handleUploadClick}
          disabled={images.length >= 4}
          className={`${images.length >= 4 ? 'bg-gray-300' : 'bg-[#F16222] hover:bg-[#D9531E]'} text-white flex items-center gap-2 px-4 md:px-6 h-10 md:h-12 rounded-xl transition-all shadow-sm shrink-0 w-full sm:w-auto`}
        >
          <KeenIcon icon="upload" className="size-4 md:size-5" />
          <span className="font-bold uppercase tracking-wider text-[10px] md:text-[11px]">Upload Images</span>
        </Button> */}
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {images.map((img: any, index: number) => (
          <div key={img.id || index} className="space-y-2 md:space-y-3 group">
            <div className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all shadow-sm ${index === 0 ? 'border-blue-500' : 'border-transparent bg-gray-50'}`}>
              <img
                src={resolveImageUrl(img.url)}
                alt={img.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Hover Actions Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-xl z-20">
                {!img.is_main && (
                  <button
                    type="button"
                    onClick={() => handleSetMainImage(index)}
                    className="bg-white/90 hover:bg-white text-gray-800 text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-transform hover:scale-105"
                  >
                    Set as Feature
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteImage(index)}
                  className="bg-white/90 hover:bg-white text-red-500 p-2 rounded-full shadow-lg transition-transform hover:scale-110"
                  title="Delete Image"
                >
                  <KeenIcon icon="trash" className="size-4 md:size-5" />
                </button>
              </div>

              {/* Featured Badge */}
              {img.is_main && (
                <div className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] md:text-[11px] font-bold px-2 py-1 rounded-md shadow-sm z-10 flex items-center gap-1 leading-none">
                  <KeenIcon icon="star" className="size-2.5 md:size-3 text-white" />
                  Feature Image
                </div>
              )}
            </div>
            <div className="px-1">
              <p className="text-[12px] md:text-[13px] font-bold text-gray-900 truncate">{img.is_main ? 'Main: ' : ''}{img.name}</p>
              {/* <p className="text-[10px] md:text-[11px] text-gray-400 truncate">{(img.size / 1024).toFixed(0)} KB</p> */}
            </div>
          </div>
        ))}

        {/* Add Photo Placeholder */}
        {images.length < 4 && (
          <div
            onClick={handleUploadClick}
            className="aspect-square border-2 border-dashed hover:border-blue-200 hover:bg-gray-50 border-gray-200 rounded-xl md:rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group "
          >
            <div className="group-hover:bg-white flex items-center rounded-xl justify-center">
              <KeenIcon icon="picture" className=" text-blue-500" />
            </div>
            <p className="text-[11px] md:text-[12px] font-bold text-gray-900 tracking-tight text-center uppercase mt-2">Add Photo</p>
            <p className="text-[9px] md:text-[10px] text-gray-400 mt-1 text-center">PNG, JPG, JPEG up to 5MB</p>
          </div>
        )}
      </div>

      {/* Guidelines Section */}
      <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-5 md:p-8 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
          <div className="bg-blue-50 p-2 rounded-xl">
            <KeenIcon icon="picture" className="text-blue-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm md:text-base">Image Guidelines</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 md:gap-y-4 gap-x-12">
          {[
            "Use a white or transparent background for a professional look.",
            "Ensure images are at least 1000px on the longest side.",
            "Show multiple angles (front, side, back, top).",
            "Maintain consistent lighting across all photos."
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2 md:gap-3">
              <div className="bg-blue-50 p-0.5 md:p-1 rounded-full mt-0.5 shrink-0 border border-blue-100">
                <KeenIcon icon="check" className="text-blue-600" />
              </div>
              <p className="text-[11px] md:text-[13px] text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductImages;
