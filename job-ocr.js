const TYPES=new Set(['image/png','image/jpeg','image/webp']);
const abortError=()=>new DOMException('已取消识别','AbortError');
export function validateScreenshot(file) {
  if(!file||!TYPES.has(file.type))throw new Error('请上传 PNG、JPG 或 WebP 截图，也可以直接粘贴岗位文字。');
  if(!file.size||file.size>8*1024*1024)throw new Error('单张截图请控制在 8 MB 以内。');
}
export function ocrPaths(base=new URL('./vendor/ocr/',import.meta.url)) {
  return {workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang',base).href,workerBlobURL:false,cacheMethod:'none'};
}
const messages={'loading tesseract core':'正在准备识别引擎','loading language traineddata':'正在加载中英文字库','initializing api':'正在准备识别','recognizing text':'正在识别截图'};

export async function recognizeImage(image,{signal,onProgress=()=>{},workerFactory,workerOptions={},timeout=90000}={}) {
  let worker,timeoutID,abortListener,rejectFailure,stopped=false;
  const failure=new Promise((_,reject)=>{rejectFailure=reject;});
  const check=()=>{if(signal?.aborted)throw abortError();};
  const stop=()=>{rejectFailure(abortError());if(worker)void worker.terminate();};
  const work=async()=>{
    check();onProgress({message:'正在加载截图识别工具',progress:0});
    let createWorker=workerFactory;
    if(!createWorker){
      try{
        const {default:Tesseract}=await import('./vendor/ocr/tesseract.esm.min.js');
        createWorker=Tesseract?.createWorker;
        if(typeof createWorker!=='function')throw new Error('Missing OCR worker factory');
      }
      catch{throw new Error('截图识别工具暂未加载成功，请刷新重试，或直接粘贴岗位文字。');}
    }
    check();
    worker=await createWorker(['eng','chi_sim'],1,{...ocrPaths(),...workerOptions,
      logger:message=>{if(!signal?.aborted)onProgress({message:messages[message.status]||'正在准备识别',progress:Math.max(0,Math.min(1,Number(message.progress)||0))});},
      errorHandler:()=>rejectFailure(new Error('截图识别未能完成，请重试或直接粘贴岗位文字。'))});
    if(signal?.aborted||stopped){await worker.terminate();throw abortError();}
    await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
    const result=await worker.recognize(image);
    check();return {text:result.data.text.trim(),confidence:result.data.confidence};
  };
  try{
    abortListener=stop;signal?.addEventListener('abort',abortListener,{once:true});
    timeoutID=setTimeout(()=>{rejectFailure(new Error('识别用时过长，请裁剪岗位正文后重试，或直接粘贴文字。'));if(worker)void worker.terminate();},timeout);
    // A cancelled initialization may settle later: release its worker instead of applying stale OCR text.
    const running=work();
    return await Promise.race([running,failure]);
  }finally{stopped=true;clearTimeout(timeoutID);signal?.removeEventListener('abort',abortListener);if(worker)await worker.terminate();}
}

export async function readScreenshot(file,options={}) {
  validateScreenshot(file);
  if(options.signal?.aborted)throw abortError();
  if(typeof createImageBitmap!=='function')throw new Error('当前浏览器无法读取截图，请换用新版浏览器，或直接粘贴岗位文字。');
  let bitmap;
  try{bitmap=await createImageBitmap(file);}
  catch{throw new Error('图片无法读取，请重新截图并保存为 PNG、JPG 或 WebP 后重试。');}
  try{
    if(options.signal?.aborted)throw abortError();
    if(bitmap.width*bitmap.height>20000000||bitmap.width<80||bitmap.height<40)throw new Error('截图尺寸不适合识别，请裁剪岗位正文后重试。');
    const scale=Math.min(1.6,Math.max(1,1400/bitmap.width),Math.sqrt(20000000/(bitmap.width*bitmap.height)));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d');if(!context)throw new Error('当前浏览器无法读取截图，请直接粘贴岗位文字。');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await recognizeImage(canvas,options);
  }finally{bitmap.close();}
}
