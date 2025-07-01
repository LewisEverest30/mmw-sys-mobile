import httpClient from '@/utils/request';
import { type ApiResponse } from '@/utils/request';

// 定义返回数据的接口类型
interface OnlineUserCount {
  count: number;
}

interface UserWarning {
  id: number;
  userId: string;
  warningType: string;
  warningTime: string;
  warningContent: string;
  isProcessed: boolean;
}

interface WarningCount {
  total: number;
  processed: number;
  unprocessed: number;
}

interface CityUserCount {
  cityName: string;
  count: number;
}

interface DateWarningCount {
  date: string;
  count: number;
}

// 获取在线用户数量
export function getOnlineUsrCnt(): Promise<ApiResponse<OnlineUserCount>> {
  return httpClient.get<OnlineUserCount>('/usr/getOnlineUsrCnt');
}

// 获取用户告警信息
export function getUsrWarning(num: number): Promise<ApiResponse<UserWarning[]>> {
  return httpClient.get<UserWarning[]>(`/usr/getUsrWarning/${num}`);
}

// 获取告警总数
export function getWarningCnt(): Promise<ApiResponse<WarningCount>> {
  return httpClient.get<WarningCount>('/usr/getWarningCnt');
}

// 获取每个城市的用户数量
export function getUsrCntPerCity(): Promise<ApiResponse<CityUserCount[]>> {
  return httpClient.get<CityUserCount[]>('/usr/getUsrCntPerCity');
}

// 获取每天的用户告警数量
export function getUsrWarningCntPerDate(): Promise<ApiResponse<DateWarningCount[]>> {
  return httpClient.get<DateWarningCount[]>('/usr/getUsrWarningCntPerDate');
}