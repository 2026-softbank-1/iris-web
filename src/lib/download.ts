/** 문자열을 텍스트 파일로 내려받게 한다. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 클릭이 다운로드를 시작한 뒤에 주소를 푼다.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
