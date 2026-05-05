import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { KeenIcon } from "@/components";
import { toast } from "sonner";
import { resolveImageUrl } from "@/utils/imageUtils";
import clsx from 'clsx';

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
    const selectedImage = { ...images[index], is_main: true };
    const otherImages = images
      .filter((_: any, i: number) => i !== index)
      .map((img: any) => ({ ...img, is_main: false }));

    const newImages = [selectedImage, ...otherImages];
    formik.setFieldValue('images', newImages);
    toast.success("Feature image updated");
  };

  return (
    <div className="space-y-6 md:space-y-8 p-1 animate-in fade-in duration-500">
      {/* Hidden File Input */}

      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-gray-900">Product Images ({images.length}/4)</h2>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          Upload and manage up to 4 high-quality photos. The first image will be your primary display.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".jpg, .jpeg, .png"
          multiple
          className="hidden"
        />
      </div>

      {/* Images Grid */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {images.map((img: any, index: number) => (
          <div key={img.id || index} className="space-y-3 group flex-shrink-0 w-64">
            <div className={clsx(
              "relative aspect-video rounded-xl overflow-hidden border transition-all",
              img.is_main ? "border-gray-900 shadow-md" : "border-gray-100 bg-[#f8fafc]"
            )}>
              <img
                src={resolveImageUrl(img.url)}
                alt={img.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Hover Actions Overlay */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
                {!img.is_main && (
                  <button
                    type="button"
                    onClick={() => handleSetMainImage(index)}
                    className="bg-white text-gray-900 text-[11px] font-bold px-4 py-1.5 rounded-full shadow-lg transition-transform hover:scale-105"
                  >
                    Set Feature
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteImage(index)}
                  className="bg-white text-red-500 p-2.5 rounded-full shadow-lg transition-transform hover:scale-110"
                >
                  <KeenIcon icon="trash" className="size-4" />
                </button>
              </div>

              {/* Featured Badge */}
              {img.is_main && (
                <div className="absolute top-3 left-3 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm z-10 flex items-center gap-1.5 uppercase tracking-wider">
                  <KeenIcon icon="star" className="size-2.5" />
                  Main
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
            className="aspect-video border-2 border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group flex-shrink-0 w-64"
          >
            <div className="bg-[#f8fafc] group-hover:bg-white p-3 rounded-full transition-colors">
              <KeenIcon icon="picture" className="text-gray-400 group-hover:text-gray-600 size-6" />
            </div>
            <p className="text-[13px] font-semibold text-gray-900 mt-3">Add Photo</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Max 5MB</p>
          </div>
        )}
      </div>

      {/* Guidelines Section */}
      <div className="bg-[#f8fafc] border border-gray-100 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-bold text-gray-900 text-[14px]">Image Guidelines</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "Use a white background for a professional look.",
            "Ensure images are at least 1000px.",
            "Show multiple angles of your product.",
            "Maintain consistent lighting."
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-full shrink-0 border border-gray-100">
                <KeenIcon icon="check" className="text-gray-900 size-3" />
              </div>
              <p className="text-[13px] text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductImages;
