import {
  COVER_CONTENT_TYPE_EXTENSIONS,
  COVER_MAX_SIZE_BYTES,
} from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import {
  useCreateNovelCoverUploadUrlMutation,
  useGetNovelQuery,
  useGetNovelsQuery,
  useSearchNovelsQuery,
  useSetNovelCoverMutation,
} from '../../generated/graphql';
import { NovelCoverConfirmForm } from './NovelCoverConfirmForm';

interface NovelCoverUploadProps {
  novelId: string;
  novelName: string;
  coverUrl?: string | null;
}

const COVER_ALLOWED_CONTENT_TYPES = Object.keys(
  COVER_CONTENT_TYPE_EXTENSIONS,
);

function getPickError(file: File): string | null {
  if (!COVER_ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return 'The cover must be a JPEG, PNG or WebP image.';
  }

  if (file.size === 0) {
    return 'The cover file is empty.';
  }

  if (file.size > COVER_MAX_SIZE_BYTES) {
    return `The cover must be ${COVER_MAX_SIZE_BYTES / 1024 / 1024} MB or smaller.`;
  }

  return null;
}

async function putToBucket(
  uploadUrl: string,
  file: File,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
  } catch {
    throw new Error(
      'The upload failed. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new Error(`The upload was rejected (${response.status}).`);
  }
}

export function NovelCoverUpload({
  novelId,
  novelName,
  coverUrl,
}: NovelCoverUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const createUploadUrlMutation =
    useCreateNovelCoverUploadUrlMutation();
  const setNovelCoverMutation = useSetNovelCoverMutation();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];

    // Lets the same file be picked again after a cancel.
    event.target.value = '';

    if (!picked) {
      return;
    }

    const error = getPickError(picked);

    setPickError(error);
    setUploadError(null);
    setFile(error ? null : picked);
  };

  const handleCancel = () => {
    setFile(null);
    setUploadError(null);
  };

  const handleConfirm = async () => {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { createNovelCoverUploadUrl } =
        await createUploadUrlMutation.mutateAsync({
          novelId,
          contentType: file.type,
          contentLength: file.size,
        });
      await putToBucket(createNovelCoverUploadUrl.uploadUrl, file);
      await setNovelCoverMutation.mutateAsync({
        novelId,
        objectKey: createNovelCoverUploadUrl.objectKey,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: useGetNovelQuery.getKey({ id: novelId }),
        }),
        queryClient.invalidateQueries({
          queryKey: useGetNovelsQuery.getKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: useSearchNovelsQuery.getKey(),
        }),
      ]);
      setFile(null);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Try again later.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-lg border p-6 border-gray-700 bg-gray-800">
      <h2 className="mb-4 text-lg font-bold text-white">Cover</h2>
      {file ? (
        <NovelCoverConfirmForm
          previewUrl={previewUrl}
          fileName={file.name}
          fileSize={file.size}
          isUploading={isUploading}
          error={uploadError}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : (
        <div className="flex items-start gap-4">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={novelName}
              className="h-64 w-48 rounded-lg object-cover shadow"
            />
          ) : (
            <p className="text-sm text-gray-400">
              This novel has no cover yet.
            </p>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={COVER_ALLOWED_CONTENT_TYPES.join(',')}
              onChange={handleFilePicked}
              className="hidden"
              data-testid="cover-file-input"
            />
            <Button
              variant="outline"
              color="gray"
              onClick={() => fileInputRef.current?.click()}
            >
              Change cover
            </Button>
            {pickError && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {pickError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
