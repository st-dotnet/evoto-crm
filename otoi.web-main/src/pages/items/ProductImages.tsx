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
      if (!isAllowed) toast.error(`File ${file.name} is not a supported format. Only JPG, JPEG, PNG allowed.`);
      return isAllowed;
    });

    if (fileList.length === 0) { event.target.value = ''; return; }

    if (fileList.length > remainingSlots)
      toast.warning(`Only the first ${remainingSlots} image(s) will be uploaded.`);

    const filesToUpload = fileList.slice(0, remainingSlots);

    const uploadPromises = filesToUpload.map(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Max size is 5MB.`);
        return null;
      }
      return {
        url: URL.createObjectURL(file),
        file,
        name: file.name,
        size: file.size,
        id: Date.now() + Math.random(),
        is_main: false,
      };
    });

    const newValidImages = uploadPromises.filter(img => img !== null);

    if (newValidImages.length > 0) {
      const updatedImages = [...images, ...newValidImages];
      if (images.length === 0) updatedImages[0].is_main = true;
      formik.setFieldValue('images', updatedImages);
      toast.success(`Successfully added ${newValidImages.length} image(s)`);
    }

    event.target.value = '';
  };

  const handleDeleteImage = (index: number) => {
    const newImages = [...images];
    const wasMain = newImages[index].is_main;
    newImages.splice(index, 1);
    if (wasMain && newImages.length > 0) newImages[0].is_main = true;
    formik.setFieldValue('images', newImages);
    toast.success("Image removed");
  };

  const handleSetMainImage = (index: number) => {
    const selected = { ...images[index], is_main: true };
    const others = images
      .filter((_: any, i: number) => i !== index)
      .map((img: any) => ({ ...img, is_main: false }));
    formik.setFieldValue('images', [selected, ...others]);
    toast.success("Feature image updated");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-zinc-100">
          Product Images ({images.length}/4)
        </h2>
        <p className="text-[13px] text-gray-500 dark:text-zinc-400 leading-relaxed">
          Upload and manage up to 4 high-quality photos. The first image will be your primary display.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".jpg,.jpeg,.png"
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
              img.is_main
                ? "border-gray-900 dark:border-zinc-300 shadow-md"
                : "border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800"
            )}>
              <img
                src={resolveImageUrl(img.url)}
                alt={img.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Hover Actions Overlay */}
              <div className="absolute inset-0 bg-black/20 dark:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
                {!img.is_main && (
                  <button
                    type="button"
                    onClick={() => handleSetMainImage(index)}
                    className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-[11px] font-bold px-4 py-1.5 rounded-full shadow-lg transition-transform hover:scale-105"
                  >
                    Set Feature
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteImage(index)}
                  className="bg-white dark:bg-zinc-800 text-red-500 dark:text-red-400 p-2.5 rounded-full shadow-lg transition-transform hover:scale-110"
                >
                  <KeenIcon icon="trash" className="size-4" />
                </button>
              </div>

              {/* Featured Badge */}
              {img.is_main && (
                <div className="absolute top-3 left-3 bg-gray-900 dark:bg-zinc-700 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm z-10 flex items-center gap-1.5 uppercase tracking-wider">
                  <KeenIcon icon="star" className="size-2.5" />
                  Main
                </div>
              )}
            </div>

            <div className="px-1">
              <p className="text-[12px] md:text-[13px] font-bold text-gray-900 dark:text-zinc-100 truncate">
                {img.is_main ? 'Main: ' : ''}{img.name}
              </p>
            </div>
          </div>
        ))}

        {/* Add Photo Placeholder */}
        {images.length < 4 && (
          <div
            onClick={handleUploadClick}
            className="aspect-video border-2 border-dashed border-blue-300 dark:border-blue-500/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all group flex-shrink-0 w-64"
          >
            <div className="bg-gray-50 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 p-3 rounded-full transition-colors">
              <KeenIcon icon="picture" className="text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 size-6" />
            </div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-zinc-200 mt-3">Add Photo</p>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">Max 5MB</p>
          </div>
        )}
      </div>

      {/* Guidelines */}
      <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/60 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-[14px] mb-4">
          Image Guidelines
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "Use a white background for a professional look.",
            "Ensure images are at least 1000px.",
            "Show multiple angles of your product.",
            "Maintain consistent lighting.",
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="bg-white dark:bg-zinc-700 p-1 rounded-full shrink-0 border border-gray-100 dark:border-zinc-600">
                <KeenIcon icon="check" className="text-gray-900 dark:text-zinc-200 size-3" />
              </div>
              <p className="text-[13px] text-gray-600 dark:text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductImages;