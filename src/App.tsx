import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Wand2, FolderOpen, Image as ImageIcon, Video, Box, Upload, Download, ArrowLeft, Sparkles, Search, ChevronDown, CheckSquare, ListFilter, LayoutGrid, List, CheckCircle2, Circle, Trash2, Heart, Check, Edit, RefreshCw, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { imageToPrompt } from './services/image-to-prompt';
import { fetchGenerationBatches } from './services/generation-batches';
import { generateImages, type GenerationBatch, type GenerateImagesRequest } from './services/generate-images';
import { buildDownloadFileName, downloadImage, downloadImages } from './services/image-download';
import { deleteGenerationAssets } from './services/delete-generation-assets';
import { SUPPORTED_ASPECT_RATIOS, toAspectRatio } from './utils/aspect-ratios';
import { toAssetItemsFromBatches } from './features/assets/asset-items';
import { dequeueStartableJobs } from './features/generation/job-queue';
import { applyBatchToJob, createQueuedJob, markJobRequestFailed, markJobRunning, type GenerationUiJob } from './features/generation/job-state';
import { EXPLORE_IMAGES as EXPLORE_IMAGES_LIBRARY } from './data/explore-images';

const MOCK_IMAGES = [
  { id: 1, url: 'https://picsum.photos/seed/cine1/800/1200', prompt: 'A cinematic shot of a futuristic city...', ratio: '2.39:1', model: 'CineVision v2.4', seed: '84729103' },
  { id: 2, url: 'https://picsum.photos/seed/cine2/800/1200', prompt: 'Neon lit streets with rain...', ratio: '16:9', model: 'CineVision v2.4', seed: '12398471' },
  { id: 3, url: 'https://picsum.photos/seed/cine3/800/1200', prompt: 'Dark fantasy landscape...', ratio: '3:4', model: 'CineVision v2.4', seed: '99823412' },
  { id: 4, url: 'https://picsum.photos/seed/cine4/800/1200', prompt: 'Sci-fi spaceship interior...', ratio: '9:16', model: 'CineVision v2.4', seed: '55623109' },
  { id: 5, url: 'https://picsum.photos/seed/cine5/800/1200', prompt: 'Cyberpunk character portrait...', ratio: '1:1', model: 'CineVision v2.4', seed: '11223344' },
  { id: 6, url: 'https://picsum.photos/seed/cine6/800/1200', prompt: 'Epic mountain range at sunset...', ratio: '16:9', model: 'CineVision v2.4', seed: '55667788' },
  { id: 7, url: 'https://picsum.photos/seed/cine7/800/1200', prompt: 'Abandoned space station...', ratio: '2.39:1', model: 'CineVision v2.4', seed: '99001122' },
  { id: 8, url: 'https://picsum.photos/seed/cine8/800/1200', prompt: 'Magical glowing forest...', ratio: '4:3', model: 'CineVision v2.4', seed: '33445566' },
  { id: 9, url: 'https://picsum.photos/seed/cine9/800/1200', prompt: 'Noir detective in the rain...', ratio: '3:4', model: 'CineVision v2.4', seed: '77889900' },
  { id: 10, url: 'https://picsum.photos/seed/cine10/800/1200', prompt: 'Giant mecha in a ruined city...', ratio: '16:9', model: 'CineVision v2.4', seed: '12345678' },
  { id: 11, url: 'https://picsum.photos/seed/cine11/800/1200', prompt: 'Ethereal underwater ruins...', ratio: '9:16', model: 'CineVision v2.4', seed: '87654321' },
  { id: 12, url: 'https://picsum.photos/seed/cine12/800/1200', prompt: 'Steampunk flying machine...', ratio: '2.39:1', model: 'CineVision v2.4', seed: '13579246' },
  { id: 13, url: 'https://picsum.photos/seed/cine13/800/1200', prompt: 'Post-apocalyptic desert...', ratio: '16:9', model: 'CineVision v2.4', seed: '24681357' },
  { id: 14, url: 'https://picsum.photos/seed/cine14/800/1200', prompt: 'Alien flora and fauna...', ratio: '4:3', model: 'CineVision v2.4', seed: '11221122' },
  { id: 15, url: 'https://picsum.photos/seed/cine15/800/1200', prompt: 'Gothic cathedral interior...', ratio: '3:4', model: 'CineVision v2.4', seed: '99887766' },
  { id: 16, url: 'https://picsum.photos/seed/cine16/800/1200', prompt: 'Neon samurai showdown...', ratio: '2.39:1', model: 'CineVision v2.4', seed: '55443322' },
];

const INITIAL_GENERATION_BATCHES = [
  {
    id: 'batch_1',
    prompt: '第一人称视角，镜头前可见戴着浅色医用手套的双手，正紧握病床两侧冰冷扶手。病床上躺着沉睡病人，头部有明显缝合伤痕，环境是夜晚阴森的医院病房。',
    model: '图片5.0 Lite',
    ratio: '16:9',
    resolution: '2K',
    images: [
      { id: 1, url: 'https://picsum.photos/seed/cine1/800/450' },
      { id: 2, url: 'https://picsum.photos/seed/cine2/800/450' },
      { id: 3, url: 'https://picsum.photos/seed/cine3/800/450' },
      { id: 4, url: 'https://picsum.photos/seed/cine4/800/450' },
    ]
  },
  {
    id: 'batch_2',
    prompt: 'A cinematic shot of a futuristic city at night, neon lights, flying cars, 8k resolution, highly detailed.',
    model: 'CineVision v2.4',
    ratio: '2.39:1',
    resolution: '4K',
    images: [
      { id: 5, url: 'https://picsum.photos/seed/cine5/800/334' },
      { id: 6, url: 'https://picsum.photos/seed/cine6/800/334' },
      { id: 7, url: 'https://picsum.photos/seed/cine7/800/334' },
      { id: 8, url: 'https://picsum.photos/seed/cine8/800/334' },
    ]
  },
  {
    id: 'batch_3',
    prompt: 'Dark fantasy landscape, ancient ruins, glowing crystals, moody lighting.',
    model: 'CineVision v2.4',
    ratio: '16:9',
    resolution: '1080p',
    images: [
      { id: 9, url: 'https://picsum.photos/seed/cine9/800/450' },
      { id: 10, url: 'https://picsum.photos/seed/cine10/800/450' },
      { id: 11, url: 'https://picsum.photos/seed/cine11/800/450' },
      { id: 12, url: 'https://picsum.photos/seed/cine12/800/450' },
    ]
  },
  {
    id: 'batch_4',
    prompt: 'Post-apocalyptic desert, rusted mechs half buried in sand, cinematic color grading.',
    model: 'CineVision v2.4',
    ratio: '16:9',
    resolution: '1080p',
    images: [
      { id: 13, url: 'https://picsum.photos/seed/cine13/800/450' },
      { id: 14, url: 'https://picsum.photos/seed/cine14/800/450' },
      { id: 15, url: 'https://picsum.photos/seed/cine15/800/450' },
      { id: 16, url: 'https://picsum.photos/seed/cine16/800/450' },
    ]
  }
];

const EXPLORE_IMAGES = [
  { id: 101, url: 'https://picsum.photos/seed/exp1/800/1200', prompt: 'A cyberpunk city skyline at night, neon lights, flying cars, cinematic lighting, 8k resolution.', ratio: '16:9', model: 'CineVision v2.4', seed: '84729103' },
  { id: 102, url: 'https://picsum.photos/seed/exp2/800/1200', prompt: 'A lone astronaut standing on a barren alien planet, two massive moons in the sky, dramatic shadows.', ratio: '2.39:1', model: 'CineVision v2.4', seed: '12398471' },
  { id: 103, url: 'https://picsum.photos/seed/exp3/800/1200', prompt: 'Fantasy medieval castle on a cliff edge, dragons flying in the distance, sunset, epic scale.', ratio: '3:4', model: 'CineVision v2.4', seed: '99823412' },
  { id: 104, url: 'https://picsum.photos/seed/exp4/800/1200', prompt: 'Close up portrait of a mysterious woman with glowing blue eyes, dark hood, rain drops.', ratio: '9:16', model: 'CineVision v2.4', seed: '55623109' },
  { id: 105, url: 'https://picsum.photos/seed/exp5/800/1200', prompt: 'Post-apocalyptic wasteland, rusted mechs half buried in sand, cinematic color grading.', ratio: '16:9', model: 'CineVision v2.4', seed: '77238192' },
  { id: 106, url: 'https://picsum.photos/seed/exp6/800/1200', prompt: 'A magical glowing forest, giant mushrooms, fairies, ethereal light rays penetrating the canopy.', ratio: '4:3', model: 'CineVision v2.4', seed: '33491827' },
  { id: 107, url: 'https://picsum.photos/seed/exp7/800/1200', prompt: 'Noir detective standing under a street lamp, smoking, heavy rain, black and white with a splash of red.', ratio: '2.39:1', model: 'CineVision v2.4', seed: '11293847' },
  { id: 108, url: 'https://picsum.photos/seed/exp8/800/1200', prompt: 'Futuristic racing vehicles hovering over a neon track, motion blur, high octane action.', ratio: '16:9', model: 'CineVision v2.4', seed: '88273645' },
];

const MOCK_IMAGES_WITH_META = MOCK_IMAGES.map((img, i) => ({
  ...img,
  timestamp: Date.now() - i * 1000000,
  folder: i % 2 === 0 ? 'project_a' : 'project_b'
}));

const ASSET_IMAGES = [
  ...MOCK_IMAGES_WITH_META,
  ...Array.from({ length: 50 }).map((_, i) => ({
    id: 200 + i,
    url: `https://picsum.photos/seed/asset${i}/400/225`,
    prompt: `Cinematic asset generation ${i}...`,
    ratio: '16:9',
    model: 'CineVision v2.4',
    seed: Math.floor(Math.random() * 100000000).toString(),
    timestamp: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
    folder: Math.random() > 0.5 ? 'project_a' : 'project_b'
  }))
];

function toGenerateCount(value: number): GenerateImagesRequest['count'] | null {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return null;
}

type UiBatchImage = {
  id: string;
  url?: string;
  position: number;
  status: 'loading' | 'success' | 'failed';
  errorMessage?: string;
};

type UiBatch = {
  id: string;
  prompt: string;
  model: string;
  ratio: string;
  createdAt: number;
  resolution: string;
  requestedCount: 1 | 2 | 3 | 4;
  status: 'queued' | 'running' | 'completed' | 'partial_failed' | 'failed';
  images: UiBatchImage[];
  errorMessage?: string;
};

function toUiBatch(batch: GenerationBatch): UiBatch {
  return {
    id: batch.id,
    prompt: batch.prompt,
    model: batch.model,
    ratio: batch.aspectRatio,
    createdAt: batch.createdAt,
    resolution: `${batch.requestedCount} image(s)`,
    requestedCount: batch.requestedCount as 1 | 2 | 3 | 4,
    status: batch.status,
    images: batch.items.map((item) => ({
      id: item.id,
      position: item.position,
      url: item.imageUrl,
      status: item.status,
      errorMessage: item.errorMessage,
    })),
  };
}

const MAX_CONCURRENT_GENERATIONS = 2;

type QueueJob = {
  id: string;
  localBatchId: string;
  prompt: string;
  aspectRatio: GenerateImagesRequest['aspectRatio'];
  count: GenerateImagesRequest['count'];
  createdAt: number;
  status: 'queued' | 'running';
};

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toUiBatchFromJob(job: GenerationUiJob): UiBatch {
  return {
    id: job.id,
    prompt: job.prompt,
    model: job.model,
    ratio: job.aspectRatio,
    createdAt: job.createdAt,
    resolution: `${job.count} image(s)`,
    requestedCount: job.count,
    status:
      job.status === 'queued'
        ? 'queued'
        : job.status === 'running'
          ? 'running'
          : job.status === 'failed'
            ? 'failed'
            : job.batchStatus ?? 'completed',
    images: job.previewItems.map((item) => ({
      id: item.id,
      position: item.position,
      url: item.url,
      status: item.status,
      errorMessage: item.errorMessage,
    })),
    errorMessage: job.errorMessage,
  };
}

function toBatchStatusLabel(status: UiBatch['status']): string {
  if (status === 'queued') {
    return '排队中';
  }
  if (status === 'running') {
    return '生成中';
  }
  if (status === 'partial_failed') {
    return '部分完成';
  }
  if (status === 'failed') {
    return '失败';
  }
  return '已完成';
}

const SCENE_OPTIONS = [
  {
    id: 'poster',
    label: '1. 影视海报创作',
    desc: '专业级影视宣发海报生成',
    icon: <ImageIcon className="text-[#00FFFF]" size={20} />,
    subScenes: [
      { id: 'movie_poster', label: '院线电影主海报', desc: '高精度、大画幅的院线级海报' },
      { id: 'web_drama', label: '网播剧宣传海报（单人/群像）', desc: '适合网络传播的剧集海报' },
      { id: 'variety_show', label: '综艺/纪录片概念海报', desc: '创意概念与视觉传达' },
    ],
  },
  {
    id: 'ip',
    label: '2. IP角色可视化',
    desc: '将文字或动漫IP转化为具象角色',
    icon: <Box className="text-[#00FFFF]" size={20} />,
    subScenes: [
      { id: 'fan_art', label: '热门影视IP角色同人形象', desc: '基于现有影视角色的二次创作' },
      { id: 'novel_ip', label: '未影视化小说IP角色具象化', desc: '根据文字描述生成角色形象' },
      { id: 'anime_to_real', label: '动漫IP角色真人风转绘', desc: '二次元角色转换为真人风格' },
    ],
  },
  {
    id: 'scene',
    label: '3. 影视场景概念设计',
    desc: '构建宏大或写实的影视世界观',
    icon: <Compass className="text-[#00FFFF]" size={20} />,
    subScenes: [
      { id: 'scifi', label: '科幻/奇幻片世界观场景搭建', desc: '充满想象力的异世界或未来场景' },
      { id: 'historical', label: '古装剧历史还原场景绘制', desc: '考究的历史建筑与环境氛围' },
      { id: 'modern', label: '现代剧生活化场景优化', desc: '真实的现代生活场景与光影' },
    ],
  },
  {
    id: 'short_video',
    label: '4. 影视宣发短视频配图',
    desc: '为短视频平台量身定制的宣发素材',
    icon: <Video className="text-[#00FFFF]" size={20} />,
    subScenes: [
      { id: 'storyboard', label: '剧情高光时刻分镜图', desc: '捕捉影视剧中最具张力的瞬间' },
      { id: 'relationship', label: '角色人物关系图', desc: '清晰展现角色间的复杂关系' },
      { id: 'cover', label: '宣发短视频封面图', desc: '高点击率的短视频封面设计' },
    ],
  },
  {
    id: 'merch',
    label: '5. 影视衍生品素材',
    desc: '影视IP周边及线下活动视觉设计',
    icon: <Sparkles className="text-[#00FFFF]" size={20} />,
    subScenes: [
      { id: 'emoji', label: '角色Q版表情包', desc: '可爱生动的角色Q版形象' },
      { id: 'product', label: '周边产品图案（手办/文具/服饰）', desc: '适用于各类衍生品的图案设计' },
      { id: 'offline', label: '线下主题展打卡点素材', desc: '沉浸式线下展览的视觉物料' },
    ],
  },
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState('explore');
  const [scene, setScene] = useState('poster');
  const [subScene, setSubScene] = useState('movie_poster');
  const [aspectRatio, setAspectRatio] = useState<GenerateImagesRequest['aspectRatio']>('16:9');
  const [prompt, setPrompt] = useState('');
  const [previewType, setPreviewType] = useState('image');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [generateCount, setGenerateCount] = useState<1 | 2 | 3 | 4>(1);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');
  const uploadAbortRef = useRef<AbortController | null>(null);
  const latestUploadSeqRef = useRef(0);
  const generationJobsRef = useRef<QueueJob[]>([]);
  const generationDispatchingRef = useRef(false);
  const [queueStats, setQueueStats] = useState({ queued: 0, running: 0 });
  
  // Generation Batches State
  const [generationBatches, setGenerationBatches] = useState<UiBatch[]>([]);
  const [openBatchMenu, setOpenBatchMenu] = useState<string | null>(null);

  // Assets View State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<Set<number | string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const [isSecondaryDropdownOpen, setIsSecondaryDropdownOpen] = useState(false);

  const selectedPrimaryScene = SCENE_OPTIONS.find(s => s.id === scene) || SCENE_OPTIONS[0];
  const secondaryOptions = selectedPrimaryScene.subScenes;
  const selectedSecondaryScene = secondaryOptions.find(s => s.id === subScene) || secondaryOptions[0];

  const toggleFavorite = (e: React.MouseEvent, id: number | string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavs = new Set(prev);
      if (newFavs.has(id)) newFavs.delete(id);
      else newFavs.add(id);
      return newFavs;
    });
  };

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!downloadMessage) {
      return;
    }
    const timer = setTimeout(() => setDownloadMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [downloadMessage]);

  useEffect(() => {
    let active = true;
    setIsLoadingBatches(true);
    setGenerationError('');

    fetchGenerationBatches()
      .then((batches) => {
        if (!active) return;
        const serverBatches = batches.map(toUiBatch);
        setGenerationBatches((prev) => {
          const inFlightBatches = prev.filter((batch) => batch.status === 'queued' || batch.status === 'running');
          const inFlightIds = new Set(inFlightBatches.map((batch) => batch.id));
          const dedupedServer = serverBatches.filter((batch) => !inFlightIds.has(batch.id));
          return [...inFlightBatches, ...dedupedServer];
        });
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : '加载批次失败';
        setGenerationError(message);
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingBatches(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const nextImageUrl = URL.createObjectURL(file);
    setUploadedImage(nextImageUrl);
    setIsAnalyzing(true);
    setAnalysisError('');

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const currentSeq = latestUploadSeqRef.current + 1;
    latestUploadSeqRef.current = currentSeq;

    try {
      const generatedPrompt = await imageToPrompt(file, controller.signal);
      if (currentSeq !== latestUploadSeqRef.current) {
        return;
      }
      setPrompt(generatedPrompt);
    } catch (error) {
      if (controller.signal.aborted || currentSeq !== latestUploadSeqRef.current) {
        return;
      }
      const message = error instanceof Error ? error.message : '分析失败，请重试';
      setAnalysisError(message);
    } finally {
      if (currentSeq === latestUploadSeqRef.current) {
        setIsAnalyzing(false);
      }
    }

    e.target.value = '';
  };

  const handleReEdit = (batch: UiBatch) => {
    const nextAspectRatio = toAspectRatio(batch.ratio);
    const nextCount = toGenerateCount(batch.requestedCount);
    setPrompt(batch.prompt);
    if (nextAspectRatio) {
      setAspectRatio(nextAspectRatio);
    }
    if (nextCount) {
      setGenerateCount(nextCount);
    }
  };

  const syncQueueStats = () => {
    const running = generationJobsRef.current.filter((job) => job.status === 'running').length;
    const queued = generationJobsRef.current.filter((job) => job.status === 'queued').length;
    setQueueStats({ queued, running });
  };

  const buildQueuedUiJob = (job: QueueJob): GenerationUiJob =>
    createQueuedJob(
      {
        prompt: job.prompt,
        aspectRatio: job.aspectRatio,
        count: job.count,
        createdAt: job.createdAt,
      },
      { idFactory: () => job.localBatchId },
    );

  const executeGenerationJob = async (job: QueueJob) => {
    const runningJob = markJobRunning(buildQueuedUiJob(job));
    setGenerationBatches((prev) =>
      prev.map((batch) => (batch.id === job.localBatchId ? toUiBatchFromJob(runningJob) : batch)),
    );

    try {
      const nextBatch = await generateImages({
        prompt: job.prompt,
        aspectRatio: job.aspectRatio,
        count: job.count,
      });
      const completedJob = applyBatchToJob(runningJob, nextBatch);
      const completedBatch = toUiBatchFromJob(completedJob);
      setGenerationBatches((prev) =>
        prev.map((batch) =>
          batch.id === job.localBatchId
            ? {
                ...completedBatch,
                id: nextBatch.id,
                model: nextBatch.model,
                ratio: nextBatch.aspectRatio,
                createdAt: nextBatch.createdAt,
                requestedCount: nextBatch.requestedCount as 1 | 2 | 3 | 4,
              }
            : batch,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败，请稍后重试';
      const failedJob = markJobRequestFailed(runningJob, message);
      setGenerationBatches((prev) =>
        prev.map((batch) => (batch.id === job.localBatchId ? toUiBatchFromJob(failedJob) : batch)),
      );
      setGenerationError(message);
    } finally {
      generationJobsRef.current = generationJobsRef.current.filter((item) => item.id !== job.id);
      syncQueueStats();
      dispatchGenerationJobs();
    }
  };

  const dispatchGenerationJobs = () => {
    if (generationDispatchingRef.current) {
      return;
    }
    generationDispatchingRef.current = true;

    try {
      while (true) {
        const runningCount = generationJobsRef.current.filter((job) => job.status === 'running').length;
        const queueSnapshot = generationJobsRef.current.map((job) => ({
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
        }));
        const { startIds } = dequeueStartableJobs(queueSnapshot, runningCount, MAX_CONCURRENT_GENERATIONS);
        if (startIds.length === 0) {
          break;
        }

        const nextJob = generationJobsRef.current.find((job) => job.id === startIds[0] && job.status === 'queued');
        if (!nextJob) {
          break;
        }

        nextJob.status = 'running';
        syncQueueStats();
        void executeGenerationJob({ ...nextJob });
      }
    } finally {
      generationDispatchingRef.current = false;
    }
  };

  const runGeneration = async (input: { prompt: string; aspectRatio: string; count: number }) => {
    const normalizedPrompt = input.prompt.trim();
    if (!normalizedPrompt) {
      setGenerationError('提示词不能为空');
      return;
    }

    const nextAspectRatio = toAspectRatio(input.aspectRatio) ?? toAspectRatio(aspectRatio);
    if (!nextAspectRatio) {
      setGenerationError('画面比例无效');
      return;
    }

    const nextCount = toGenerateCount(input.count) ?? toGenerateCount(generateCount);
    if (!nextCount) {
      setGenerationError('生成数量必须在 1 到 4 之间');
      return;
    }

    setPrompt(normalizedPrompt);
    setAspectRatio(nextAspectRatio);
    setGenerateCount(nextCount);
    setGenerationError('');

    const createdAt = Date.now();
    const localBatchId = createLocalId('queued_batch');
    const queueJob: QueueJob = {
      id: createLocalId('job'),
      localBatchId,
      prompt: normalizedPrompt,
      aspectRatio: nextAspectRatio,
      count: nextCount,
      createdAt,
      status: 'queued',
    };
    const queuedUiJob = buildQueuedUiJob(queueJob);
    setGenerationBatches((prev) => [toUiBatchFromJob(queuedUiJob), ...prev]);
    generationJobsRef.current = [queueJob, ...generationJobsRef.current];
    syncQueueStats();
    dispatchGenerationJobs();
  };

  const handleRegenerate = async (batch: UiBatch) => {
    await runGeneration({
      prompt: batch.prompt,
      aspectRatio: batch.ratio,
      count: batch.requestedCount,
    });
  };

  const handleDeleteBatch = (batchId: string) => {
    setGenerationBatches(prev => prev.filter(b => b.id !== batchId));
    setOpenBatchMenu(null);
  };

  const handleGenerate = async () => {
    await runGeneration({
      prompt,
      aspectRatio,
      count: generateCount,
    });
  };

  const generateButtonLabel =
    queueStats.running > 0 || queueStats.queued > 0
      ? `继续提交（运行中 ${queueStats.running}/${MAX_CONCURRENT_GENERATIONS}，排队 ${queueStats.queued}）`
      : '生成';

  const assetItems = useMemo(() => toAssetItemsFromBatches(generationBatches), [generationBatches]);

  const sortedAssets = useMemo(() => {
    let result = [...assetItems];

    if (showFavoritesOnly) {
      result = result.filter((img) => favorites.has(img.id));
    }

    const normalizedAssetQuery = assetSearchQuery.trim().toLowerCase();
    if (normalizedAssetQuery) {
      result = result.filter(
        (img) =>
          img.prompt.toLowerCase().includes(normalizedAssetQuery) ||
          img.ratio.toLowerCase().includes(normalizedAssetQuery) ||
          img.id.toLowerCase().includes(normalizedAssetQuery),
      );
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today') {
        result = result.filter((img) => now - img.timestamp < day);
      } else if (dateFilter === 'week') {
        result = result.filter((img) => now - img.timestamp < 7 * day);
      } else if (dateFilter === 'month') {
        result = result.filter((img) => now - img.timestamp < 30 * day);
      }
    }

    return result.sort((a, b) => (sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp));
  }, [assetItems, assetSearchQuery, sortOrder, showFavoritesOnly, dateFilter, favorites]);

  const handleAssetClick = (img: any) => {
    if (isBatchMode) {
      const newSet = new Set(selectedAssets);
      if (newSet.has(img.id)) newSet.delete(img.id);
      else newSet.add(img.id);
      setSelectedAssets(newSet);
    } else {
      setSelectedImage(img);
    }
  };

  const filteredExploreImages = useMemo(() => {
    if (!searchQuery.trim()) return EXPLORE_IMAGES_LIBRARY;
    const lowerQuery = searchQuery.toLowerCase();
    return EXPLORE_IMAGES_LIBRARY.filter(img => 
      img.prompt.toLowerCase().includes(lowerQuery) || 
      img.ratio.includes(lowerQuery)
    );
  }, [searchQuery]);

  const getErrorMessage = (error: unknown) => {
    return error instanceof Error ? error.message : 'unknown error';
  };

  const handleDownloadOne = async (url?: string, index = 1) => {
    if (!url) {
      setDownloadMessage('下载失败：图片地址不存在');
      return;
    }

    const fileName = buildDownloadFileName({
      prefix: 'cine',
      timestamp: new Date(),
      index,
      sourceUrl: url,
    });

    try {
      await downloadImage({ url, fileName });
      setDownloadMessage(`下载成功：${fileName}`);
    } catch (error) {
      setDownloadMessage(`下载失败：${getErrorMessage(error)}`);
    }
  };

  const handleDownloadSelectedAssets = async () => {
    const selected = sortedAssets.filter((img) => selectedAssets.has(img.id));
    if (selected.length === 0) {
      setDownloadMessage('下载失败：请先选择素材');
      return;
    }

    const now = new Date();
    const result = await downloadImages(
      selected.map((img, index) => ({
        url: img.url,
        fileName: buildDownloadFileName({
          prefix: 'cine',
          timestamp: now,
          index: index + 1,
          sourceUrl: img.url,
        }),
      })),
    );

    if (result.failedCount === 0) {
      setDownloadMessage(`已下载 ${result.successCount} 张图片`);
      return;
    }

    setDownloadMessage(`已下载 ${result.successCount} 张，失败 ${result.failedCount} 张`);
  };

  const handleDeleteAssets = async (itemIds: string[]) => {
    if (itemIds.length === 0) {
      setDownloadMessage('删除失败：请先选择素材');
      return;
    }

    try {
      const result = await deleteGenerationAssets(itemIds);
      const deletedIdSet = new Set(result.deletedItemIds);

      if (deletedIdSet.size > 0) {
        setGenerationBatches((prev) =>
          prev
            .map((batch) => ({
              ...batch,
              images: batch.images.filter((img) => !deletedIdSet.has(img.id)),
            }))
            .filter((batch) => batch.images.length > 0),
        );
        setSelectedAssets((prev) => {
          const next = new Set<string>();
          prev.forEach((id) => {
            if (!deletedIdSet.has(id)) {
              next.add(id);
            }
          });
          return next;
        });
        setSelectedImage((prev: any) => (prev && deletedIdSet.has(prev.id) ? null : prev));
      }

      if (result.failedItemIds.length === 0) {
        setDownloadMessage(`已删除 ${result.deletedItemIds.length} 张图片`);
        return;
      }

      setDownloadMessage(`已删除 ${result.deletedItemIds.length} 张，失败 ${result.failedItemIds.length} 张`);
    } catch (error) {
      setDownloadMessage(`删除失败：${getErrorMessage(error)}`);
    }
  };

  const handleDeleteSelectedAssets = async () => {
    await handleDeleteAssets(Array.from(selectedAssets));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080808] text-white font-sans">
      {/* Sidebar */}
      <nav className="w-24 flex-shrink-0 border-r border-white/5 bg-[#080808] flex flex-col items-center py-8 gap-8 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00FFFF]/20 to-transparent border border-[#00FFFF]/30 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
          <span className="text-[#00FFFF] font-bold text-xl tracking-tighter">JM</span>
        </div>
        
        <MenuButton icon={<Compass size={24} />} label="探索" active={activeMenu === 'explore'} onClick={() => setActiveMenu('explore')} />
        <MenuButton icon={<Wand2 size={24} />} label="生成" active={activeMenu === 'generate'} onClick={() => setActiveMenu('generate')} />
        <MenuButton icon={<FolderOpen size={24} />} label="资产" active={activeMenu === 'assets'} onClick={() => setActiveMenu('assets')} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {downloadMessage && (
          <div className={`absolute top-4 right-4 z-[60] px-4 py-2 text-xs rounded-lg border backdrop-blur-sm ${downloadMessage.startsWith('下载失败：') ? 'text-red-300 border-red-400/40 bg-red-500/10' : 'text-[#00FFFF] border-[#00FFFF]/40 bg-black/70'}`}>
            {downloadMessage}
          </div>
        )}
        
        {/* EXPLORE VIEW */}
        {activeMenu === 'explore' && (
          <section className="flex-1 bg-[#080808] flex flex-col p-8 relative z-0 overflow-y-auto">
            {/* Header & Search */}
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold tracking-widest text-white/90">探索 <span className="text-[#00FFFF] font-bold">素材</span></h1>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <input
                  type="text"
                  placeholder="搜索风格、关键词..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full py-2 pl-11 pr-4 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-[#00FFFF]/50 focus:bg-[#00FFFF]/5 focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all duration-300 w-72"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredExploreImages.map((img, index) => (
                <div 
                  key={img.id} 
                  className="relative group rounded-xl overflow-hidden bg-[#121212] border border-white/5 cursor-pointer"
                  style={{ aspectRatio: img.ratio.replace(':', ' / ') }}
                  onClick={() => setSelectedImage(img)}
                >
                  <img src={img.url} alt="Explore Asset" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-xs text-white/80 line-clamp-2 mb-3 leading-relaxed">{img.prompt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#00FFFF] bg-[#00FFFF]/10 px-2 py-1 rounded border border-[#00FFFF]/20">{img.ratio}</span>
                      <button 
                        className="bg-white/10 hover:bg-[#00FFFF]/20 border border-white/10 hover:border-[#00FFFF] p-1.5 rounded-md text-white/70 hover:text-[#00FFFF] transition-all duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownloadOne(img.url, index + 1);
                        }}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredExploreImages.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-white/30">
                  <Search size={48} className="mb-4 opacity-20" />
                  <p className="tracking-widest text-sm uppercase">未找到与 "{searchQuery}" 相关的素材</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* GENERATE VIEW */}
        {activeMenu === 'generate' && (
          <>
            {/* Config Area */}
            <section className="w-[400px] flex-shrink-0 border-r border-white/5 bg-[#121212]/50 backdrop-blur-xl flex flex-col p-8 overflow-y-auto z-10">
              <h1 className="text-2xl font-bold tracking-widest mb-8 text-white/90">AI<span className="text-[#00FFFF] font-bold">影视生成平台</span></h1>
              
              {/* Scene Selection */}
              <div className="mb-8 flex flex-col gap-4">
                {/* Primary Scene Dropdown */}
                <div className="relative">
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">一级场景</label>
                  <div 
                    className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#121212] cursor-pointer hover:border-white/20 transition-colors"
                    onClick={() => {
                      setIsPrimaryDropdownOpen(!isPrimaryDropdownOpen);
                      setIsSecondaryDropdownOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                        {selectedPrimaryScene.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white/90">{selectedPrimaryScene.label}</span>
                        <span className="text-xs text-white/40">{selectedPrimaryScene.desc}</span>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-white/40 transition-transform duration-300 ${isPrimaryDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {isPrimaryDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                      >
                        <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                          {SCENE_OPTIONS.map(option => (
                            <div 
                              key={option.id}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${scene === option.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                              onClick={() => {
                                setScene(option.id);
                                setSubScene(option.subScenes[0].id);
                                setIsPrimaryDropdownOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                  {option.icon}
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-sm font-medium ${scene === option.id ? 'text-white' : 'text-white/80'}`}>{option.label}</span>
                                  <span className="text-xs text-white/40">{option.desc}</span>
                                </div>
                              </div>
                              {scene === option.id && <Check size={16} className="text-[#00FFFF]" />}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Secondary Scene Dropdown */}
                <div className="relative">
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">二级场景</label>
                  <div 
                    className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#121212] cursor-pointer hover:border-white/20 transition-colors"
                    onClick={() => {
                      setIsSecondaryDropdownOpen(!isSecondaryDropdownOpen);
                      setIsPrimaryDropdownOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-[#00FFFF]/20 to-transparent flex items-center justify-center text-[10px] text-[#00FFFF] font-bold border border-[#00FFFF]/20">
                          {selectedSecondaryScene.id.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white/90">{selectedSecondaryScene.label}</span>
                        <span className="text-xs text-white/40">{selectedSecondaryScene.desc}</span>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-white/40 transition-transform duration-300 ${isSecondaryDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {isSecondaryDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                      >
                        <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                          {secondaryOptions.map(option => (
                            <div 
                              key={option.id}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${subScene === option.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                              onClick={() => {
                                setSubScene(option.id);
                                setIsSecondaryDropdownOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded bg-gradient-to-br from-[#00FFFF]/20 to-transparent flex items-center justify-center text-[10px] text-[#00FFFF] font-bold border border-[#00FFFF]/20">
                                    {option.id.substring(0, 2).toUpperCase()}
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-sm font-medium ${subScene === option.id ? 'text-white' : 'text-white/80'}`}>{option.label}</span>
                                  <span className="text-xs text-white/40">{option.desc}</span>
                                </div>
                              </div>
                              {subScene === option.id && <Check size={16} className="text-[#00FFFF]" />}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="mb-8">
                <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">画面比例</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-3 text-xs rounded-lg border transition-all duration-300 flex items-center justify-center ${aspectRatio === ratio ? 'border-[#00FFFF] text-[#00FFFF] bg-[#00FFFF]/5 shadow-[0_0_15px_rgba(0,255,255,0.3)]' : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">生成数量</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      onClick={() => setGenerateCount(count as 1 | 2 | 3 | 4)}
                      className={`py-3 text-xs rounded-lg border transition-all duration-300 ${generateCount === count ? 'border-[#00FFFF] text-[#00FFFF] bg-[#00FFFF]/5 shadow-[0_0_15px_rgba(0,255,255,0.3)]' : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'}`}
                    >
                      {count} 张
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload / Reverse Prompt */}
              <div className="mb-8">
                <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">参考图 / 逆向提示词</label>
                <div className="relative group">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 ${uploadedImage ? 'border-[#00FFFF]/50 bg-[#00FFFF]/5' : 'border-white/10 bg-white/5 group-hover:border-[#00FFFF]/50 group-hover:bg-[#00FFFF]/5 group-hover:shadow-[0_0_15px_rgba(0,255,255,0.2)]'}`}>
                    {uploadedImage ? (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden">
                        <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover opacity-50" />
                        {isAnalyzing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                            <div className="flex flex-col items-center">
                              <Sparkles className="text-[#00FFFF] animate-pulse mb-2" size={20} />
                              <span className="text-xs text-[#00FFFF] tracking-widest">分析中...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <Upload className="text-white/40 mb-3 group-hover:text-[#00FFFF] transition-colors" size={24} />
                        <p className="text-sm text-white/60 group-hover:text-white transition-colors">点击或拖拽上传图片</p>
                        <p className="text-xs text-white/40 mt-1">支持逆向提示词提取</p>
                      </>
                    )}
                  </div>
                </div>
                {analysisError && !isAnalyzing && (
                  <p className="text-xs text-red-400 mt-2">{analysisError}</p>
                )}
              </div>

              {/* Prompt Input */}
              <div className="mb-8 flex-1 flex flex-col min-h-[150px]">
                <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">提示词</label>
                <div className="relative flex-1 flex flex-col">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你的画面构想..."
                    className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/90 placeholder-white/30 resize-none focus:outline-none focus:border-[#00FFFF]/50 focus:bg-[#00FFFF]/5 focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all duration-300"
                  />
                  <button className="absolute bottom-4 right-4 bg-[#121212] hover:bg-[#080808] border border-white/10 hover:border-[#00FFFF] text-white/70 hover:text-[#00FFFF] p-2 rounded-lg transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,255,0.4)] group">
                    <Sparkles size={18} className="group-hover:animate-pulse" />
                  </button>
                </div>
              </div>

              {generationError && (
                <p className="text-xs text-red-400 mb-4">{generationError}</p>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                className="w-full py-4 mt-auto rounded-xl font-medium tracking-wide transition-all duration-300 flex items-center justify-center gap-2 bg-white text-black hover:bg-[#00FFFF] hover:shadow-[0_0_20px_rgba(0,255,255,0.6)]"
              >
                <Wand2 size={18} />
                {generateButtonLabel}
              </button>
            </section>

            {/* Preview Area */}
            <section className="flex-1 bg-[#080808] flex flex-col p-8 relative z-0 overflow-y-auto">
              {/* Type Switch */}
              <div className="flex justify-center mb-8">
                <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
                  {[
                    { id: 'image', icon: <ImageIcon size={16} />, label: '图片' },
                    { id: 'video', icon: <Video size={16} />, label: '视频' },
                    { id: '3d', icon: <Box size={16} />, label: '3D' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setPreviewType(type.id)}
                      className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm transition-all duration-300 ${previewType === type.id ? 'bg-[#121212] text-[#00FFFF] shadow-[0_0_10px_rgba(0,255,255,0.1)] border border-white/5' : 'text-white/50 hover:text-white'}`}
                    >
                      {type.icon}
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batches */}
              <div className="flex-1 flex flex-col gap-8">
                {(queueStats.running > 0 || queueStats.queued > 0) && (
                  <div className="text-xs text-white/50">
                    运行中 {queueStats.running}，排队中 {queueStats.queued}
                  </div>
                )}

                {isLoadingBatches && (
                  <div className="text-sm text-white/40">加载历史批次中...</div>
                )}

                {!isLoadingBatches && generationBatches.length === 0 && (
                  <div className="text-sm text-white/40">暂无生成记录，输入提示词后点击生成。</div>
                )}

                {generationBatches.map((batch) => (
                  <div key={batch.id} className="flex flex-col gap-3">
                    {/* Batch Header */}
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm text-white/80 leading-relaxed line-clamp-2 flex-1">{batch.prompt}</p>
                      <div className="flex items-center gap-2 text-xs text-white/40 whitespace-nowrap">
                        <span>{batch.model}</span>
                        <span>|</span>
                        <span>{batch.ratio}</span>
                        <span>|</span>
                        <span>{toBatchStatusLabel(batch.status)}</span>
                      </div>
                    </div>

                    {/* Batch Images */}
                    <div className="columns-2 lg:columns-3 2xl:columns-4 gap-3">
                      {batch.images.map((img, index) => {
                        if (img.status === 'loading') {
                          return (
                            <div key={img.id} className="mb-3 break-inside-avoid">
                              <div className="relative overflow-hidden bg-[#121212] border border-white/20 p-3 flex flex-col justify-center items-center text-center min-h-[120px]">
                                <RefreshCw className="text-[#00FFFF] mb-2 animate-spin" size={18} />
                                <p className="text-xs text-white/70">第 {img.position} 张生成中...</p>
                              </div>
                            </div>
                          );
                        }

                        if (img.status === 'failed' || !img.url) {
                          return (
                            <div key={img.id} className="mb-3 break-inside-avoid">
                              <div className="relative overflow-hidden bg-[#121212] border border-red-500/40 p-3 flex flex-col justify-center items-center text-center min-h-[120px]">
                                <Circle className="text-red-400 mb-2" size={18} />
                                <p className="text-xs text-red-300">生成失败</p>
                                <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{img.errorMessage || 'unknown error'}</p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={img.id}
                            className="relative group overflow-hidden bg-[#121212] cursor-pointer break-inside-avoid mb-3"
                            onClick={() => setSelectedImage({ ...img, url: img.url, prompt: batch.prompt, ratio: batch.ratio, model: batch.model })}
                          >
                            <img src={img.url} alt="Generated" className="block w-full h-auto object-contain opacity-80 group-hover:opacity-100 transition-all duration-300" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {/* Hover Actions */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                              <button
                                className="bg-black/50 backdrop-blur-md p-1.5 rounded text-white/70 hover:text-[#00FFFF] transition-all duration-300"
                                onClick={(e) => toggleFavorite(e, img.id)}
                              >
                                <Heart size={14} className={favorites.has(img.id) ? 'fill-[#00FFFF] text-[#00FFFF]' : ''} />
                              </button>
                              <button
                                className="bg-black/50 backdrop-blur-md p-1.5 rounded text-white/70 hover:text-[#00FFFF] transition-all duration-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDownloadOne(img.url, index + 1);
                                }}
                              >
                                <Download size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Batch Footer Actions */}
                    <div className="flex items-center gap-3 mt-1">
                      {(batch.status === 'queued' || batch.status === 'running') && (
                        <div className="text-xs text-white/40">该批次正在处理中，完成后可重新编辑或再次生成。</div>
                      )}
                      <button 
                        onClick={() => handleReEdit(batch)}
                        disabled={batch.status === 'queued' || batch.status === 'running'}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                          batch.status === 'queued' || batch.status === 'running'
                            ? 'bg-[#1a1a1a] text-white/30 cursor-not-allowed'
                            : 'bg-[#1a1a1a] hover:bg-[#222] text-white/80'
                        }`}
                      >
                        <Edit size={16} /> 重新编辑
                      </button>
                      <button 
                        onClick={() => { void handleRegenerate(batch); }}
                        disabled={batch.status === 'queued' || batch.status === 'running'}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                          batch.status === 'queued' || batch.status === 'running'
                            ? 'bg-[#1a1a1a] text-white/30 cursor-not-allowed'
                            : 'bg-[#1a1a1a] hover:bg-[#222] text-white/80'
                        }`}
                      >
                        <RefreshCw size={16} /> 再次生成
                      </button>
                      <div className="relative">
                        <button 
                          disabled={batch.status === 'queued' || batch.status === 'running'}
                          onClick={() => setOpenBatchMenu(openBatchMenu === batch.id ? null : batch.id)}
                          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                            batch.status === 'queued' || batch.status === 'running'
                              ? 'bg-[#1a1a1a] text-white/30 cursor-not-allowed'
                              : openBatchMenu === batch.id
                                ? 'bg-[#222] text-white/80'
                                : 'bg-[#1a1a1a] hover:bg-[#222] text-white/80'
                          }`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        
                        {/* Dropdown Menu */}
                        <AnimatePresence>
                          {openBatchMenu === batch.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full left-0 mb-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                            >
                              <button
                                onClick={() => handleDeleteBatch(batch.id)}
                                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                              >
                                删除该批次结果
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ASSETS VIEW */}
        {activeMenu === 'assets' && (
          <section className="flex-1 bg-[#080808] flex flex-col relative z-0 overflow-hidden">
            {/* Top Navigation */}
            <div className="flex items-center justify-between px-8 pt-8 pb-8 border-b border-white/5">
              <h1 className="text-2xl font-bold tracking-widest text-white/90">创作<span className="text-[#00FFFF] font-bold">资产</span></h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                <input
                  type="text"
                  placeholder="搜索"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-4 text-xs text-white/90 placeholder-white/30 focus:outline-none focus:border-[#00FFFF]/50 focus:bg-[#00FFFF]/5 transition-all duration-300 w-48"
                />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between px-8 py-3 border-b border-white/5 bg-[#121212]/30">
              <div className="flex items-center gap-4 text-xs text-white/60">
                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
                  <FolderOpen size={14} />
                  全部文件夹
                </div>
                
                <button className="flex items-center gap-1 hover:text-white transition-colors">
                  全部类型 <ChevronDown size={12} />
                </button>
                <div className="w-px h-3 bg-white/10"></div>
                
                <div className="relative">
                  <button 
                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {dateFilter === 'all' ? '日期筛选' : dateFilter === 'today' ? '今天' : dateFilter === 'week' ? '本周' : '本月'}
                    <ChevronDown size={12} />
                  </button>
                  {isDateDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-24 bg-[#121212] border border-white/10 rounded-md shadow-xl overflow-hidden z-20">
                      {[
                        { id: 'all', label: '全部时间' },
                        { id: 'today', label: '今天' },
                        { id: 'week', label: '本周' },
                        { id: 'month', label: '本月' }
                      ].map(d => (
                        <button 
                          key={d.id}
                          onClick={() => { setDateFilter(d.id as any); setIsDateDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2 hover:bg-white/5 transition-colors ${dateFilter === d.id ? 'text-[#00FFFF]' : 'text-white/80'}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-px h-3 bg-white/10"></div>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                  <input 
                    type="checkbox" 
                    checked={showFavoritesOnly}
                    onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                    className="accent-[#00FFFF] bg-transparent border-white/20 rounded-sm" 
                  />
                  我的收藏
                </label>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/60">
                <button 
                  onClick={() => setIsBatchMode(!isBatchMode)} 
                  className={`flex items-center gap-1.5 transition-colors ${isBatchMode ? 'text-[#00FFFF]' : 'hover:text-white'}`}
                >
                  <CheckSquare size={14} />
                  {isBatchMode ? '退出批量' : '批量操作'}
                </button>
                <div className="w-px h-3 bg-white/10"></div>
                <button 
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <ListFilter size={14} className={`transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                  {sortOrder === 'desc' ? '时间降序' : '时间升序'}
                </button>
                <button 
                  onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')} 
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  {viewMode === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
                  {viewMode === 'grid' ? '平铺视图' : '列表视图'}
                </button>
              </div>
            </div>

            {/* Grid Area */}
            <div className={`flex-1 overflow-y-auto p-8 ${viewMode === 'grid' ? 'grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-3 auto-rows-max' : 'flex flex-col gap-2'}`}>
              {sortedAssets.map((img) => (
                <div 
                  key={img.id} 
                  className={`relative group rounded-md overflow-hidden bg-[#121212] border cursor-pointer transition-all duration-300 ${viewMode === 'grid' ? 'aspect-video' : 'flex h-16 items-center p-2 gap-4'} ${selectedAssets.has(img.id) ? 'border-[#00FFFF] shadow-[0_0_10px_rgba(0,255,255,0.2)]' : 'border-white/5 hover:border-white/20'}`}
                  onClick={() => handleAssetClick(img)}
                >
                  <img src={img.url} alt="Asset" className={`${viewMode === 'grid' ? 'w-full h-full object-cover' : 'w-20 h-12 object-cover rounded'} opacity-80 group-hover:opacity-100 transition-all duration-300`} />
                  {viewMode === 'grid' && <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />}

                  <button
                    className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-md p-1.5 rounded text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteAssets([img.id]);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  {viewMode === 'list' && (
                    <div className="flex-1 flex justify-between items-center px-4">
                      <p className="text-sm text-white/80 line-clamp-1">{img.prompt}</p>
                      <span className="text-xs text-white/40 font-mono">{new Date(img.timestamp).toLocaleDateString()}</span>
                    </div>
                  )}

                  {isBatchMode && (
                    <div className={`absolute ${viewMode === 'grid' ? 'top-1.5 left-1.5' : 'right-4'}`}>
                      {selectedAssets.has(img.id) ? (
                        <CheckCircle2 className="text-[#00FFFF] bg-black/50 rounded-full" size={16} />
                      ) : (
                        <Circle className="text-white/50 bg-black/20 rounded-full opacity-0 group-hover:opacity-100" size={16} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Batch Actions Bar */}
            <AnimatePresence>
              {isBatchMode && selectedAssets.size > 0 && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#121212] border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-20"
                >
                  <span className="text-sm text-white/80">已选择 <span className="text-[#00FFFF] font-bold">{selectedAssets.size}</span> 项</span>
                  <div className="w-px h-4 bg-white/10"></div>
                  <button className="text-sm hover:text-[#00FFFF] transition-colors flex items-center gap-2"
                    onClick={() => {
                      void handleDownloadSelectedAssets();
                    }}
                  >
                    <Download size={16} /> 下载
                  </button>
                  <button
                    className="text-sm hover:text-red-400 transition-colors flex items-center gap-2 text-white/70"
                    onClick={() => {
                      void handleDeleteSelectedAssets();
                    }}
                  >
                    <Trash2 size={16} /> 删除
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Detail View Overlay (Shared across all views) */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-50 bg-[#080808] flex"
            >
              {/* Left: Large Image */}
              <div className="flex-1 relative bg-black flex items-center justify-center p-12">
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-8 left-8 flex items-center gap-2 text-white/50 hover:text-[#00FFFF] transition-colors group z-10"
                >
                  <div className="p-2 rounded-full border border-white/10 group-hover:border-[#00FFFF] group-hover:shadow-[0_0_15px_rgba(0,255,255,0.4)] transition-all">
                    <ArrowLeft size={20} />
                  </div>
                  <span className="text-sm tracking-widest uppercase">返回</span>
                </button>
                
                <motion.img 
                  layoutId={`img-${selectedImage.id}`}
                  src={selectedImage.url} 
                  alt="Detail" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </div>

              {/* Right: Parameters */}
              <div className="w-[400px] bg-[#121212] border-l border-white/5 p-8 flex flex-col overflow-y-auto">
                <h2 className="text-xl font-light tracking-widest mb-8">详情</h2>
                
                <div className="space-y-8">
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">提示词</label>
                    <p className="text-sm text-white/80 leading-relaxed bg-white/5 p-4 rounded-lg border border-white/5">
                      {selectedImage.prompt}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">比例</label>
                      <div className="text-sm text-[#00FFFF] font-mono">{selectedImage.ratio}</div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">分辨率</label>
                      <div className="text-sm text-white/80 font-mono">2048 x 1024</div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">模型</label>
                      <div className="text-sm text-white/80 font-mono">{selectedImage.model || 'CineVision v2.4'}</div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">随机种子</label>
                      <div className="text-sm text-white/80 font-mono">{selectedImage.seed || '84729103'}</div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <button
                      className="w-full py-4 rounded-xl bg-[#00FFFF] text-black font-medium tracking-wide hover:bg-white hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] transition-all duration-300 flex items-center justify-center gap-2"
                      onClick={() => {
                        void handleDownloadOne(selectedImage.url);
                      }}
                    >
                      <Download size={18} />
                      下载素材
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function MenuButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300 group ${active ? 'text-[#00FFFF]' : 'text-white/40 hover:text-white/80'}`}
    >
      <div className={`p-3 rounded-xl transition-all duration-300 ${active ? 'bg-[#00FFFF]/10 shadow-[0_0_15px_rgba(0,255,255,0.2)] border border-[#00FFFF]/30' : 'bg-transparent border border-transparent group-hover:bg-white/5'}`}>
        {icon}
      </div>
      <span className="text-[10px] tracking-widest uppercase">{label}</span>
    </button>
  );
}





