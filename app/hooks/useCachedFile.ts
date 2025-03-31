import { useState, useEffect, useCallback } from 'react';
import fileCacheManager, { FileCacheManager } from '../utils/FileCacheManager';
import useWorklet from './useWorklet';

/**
 * Hook for efficiently working with cached files
 */
export const useCachedFile = (roomId: string, attachment: any) => {
  const { activeDownloadsRef, fileDownloads, downloadFile } = useWorklet();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const [hasPreview, setHasPreview] = useState(false);

  // Generate attachment key - this is the unique identifier for the file
  const attachmentKey = attachment?.blobId
    ? FileCacheManager.createCacheKey(roomId, attachment.blobId)
    : null;

  // Get download status from context
  const downloadStatus = attachmentKey ? fileDownloads[attachmentKey] : null;

  useEffect(() => {
    // Consider the file downloading if:
    // 1. It's in progress (progress between 0 and 100)
    // 2. OR it's in the active downloads ref
    const inProgress = downloadStatus && downloadStatus.progress > 0 && downloadStatus.progress < 100;
    const isPending = attachmentKey && activeDownloadsRef?.current?.has(attachmentKey);

    setIsDownloading(inProgress || !!isPending);

    // If progress is 100%, it's fully downloaded
    if (downloadStatus && downloadStatus.progress >= 100) {
      setIsCached(true);

      // Check if this is a preview
      if (downloadStatus.preview) {
        setHasPreview(true);
      }
    }
  }, [downloadStatus, attachmentKey, activeDownloadsRef]);

  // Check cache on component mount - only if we don't already know it's cached
  useEffect(() => {
    const checkCache = async () => {
      if (!attachmentKey || isCached || downloadStatus?.progress >= 100) {
        return;
      }

      // Only check cache if we don't know the status yet
      setIsCheckingCache(true);
      try {
        // Check if file exists in cache
        const exists = await fileCacheManager.fileExists(attachmentKey);

        if (exists) {
          console.log(`File ${attachment.name} found in cache`);
          setIsCached(true);

          // Check if it's a preview
          try {
            const metadata = await fileCacheManager.getMetadata(attachmentKey);
            if (metadata) {
              if (metadata.isPreview) {
                setHasPreview(true);
              }
              downloadFile(roomId, attachment, metadata.isPreview, attachmentKey);
            }
          } catch (metadataError) {
            console.error('Error getting file metadata:', metadataError);
          }
        } else {
          setIsCached(false);
        }
      } catch (error) {
        console.error('Error checking cache for file:', error);
        setIsCached(false);
      } finally {
        setIsCheckingCache(false);
      }
    };

    checkCache();
  }, [attachmentKey, roomId, attachment, isCached, downloadStatus]);

  // Function to handle downloads with cache awareness
  const handleDownload = useCallback(async (preview = false) => {
    if (!attachmentKey || isDownloading) return false;
    if (isDownloading || (activeDownloadsRef?.current?.has(attachmentKey))) {
      console.log(`Download already in progress for ${attachment.name}`);
      return false;
    }

    // If already cached but not in download state, update the state
    if (isCached) {
      console.log(`File ${attachment.name} already cached, updating state`);
      return await downloadFile(roomId, attachment, preview, attachmentKey);
    }


    // Start a new download
    setIsDownloading(true);
    return await downloadFile(roomId, attachment, preview, attachmentKey);
  }, [attachmentKey, roomId, attachment, isDownloading, isCached, downloadFile]);

  return {
    attachmentKey,
    downloadStatus,
    isDownloading,
    isCached,
    isCheckingCache,
    hasPreview,
    handleDownload
  };
};


export default useCachedFile;
