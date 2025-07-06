// 格式化时间戳
export const convertTimestampToTimeHM = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export const convertTimestampToDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}

export const convertTimestampToTimeHMS = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}
