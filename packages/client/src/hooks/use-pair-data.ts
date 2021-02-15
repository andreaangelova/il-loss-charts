import { useState, useEffect } from 'react';

import { PairPricesState, SwapsState, PairDataState } from 'types/states';

import { UniswapApiFetcher as Uniswap } from 'services/api';
import mixpanel from 'util/mixpanel';

export default function usePairData(pairId: string | null): PairDataState {
    // For all coins, fetch the following:
    // - Pair overview
    // - Historical daily data
    // - Historical hourly data (prev week)
    // - Swaps
    // - Add/remove

    const [lpInfo, setLPInfo] = useState<PairPricesState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentError, setError] = useState<string | null>(null);
    const [latestSwaps, setLatestSwaps] = useState<SwapsState>({
        swaps: null,
        mintsAndBurns: null,
    });

    useEffect(() => {
        const fetchPairData = async () => {
            if (!isLoading) setIsLoading(true);
            if (currentError || !pairId) return;

            // Fetch pair overview when pair ID changes
            // Default to createdAt date if LP date not set
            const { data: newPair, error } = await Uniswap.getPairOverview(
                pairId
            );

            if (error) {
                // we could not get data for this new pair
                console.warn(
                    `Could not fetch pair data for ${pairId}: ${error}`
                );
                setError(error);
                return;
            }

            if (newPair) {
                const createdAt = parseInt(newPair.createdAtTimestamp, 10);
                const pairCreatedAt = new Date(createdAt * 1000);
                const oneWeekAgo = new Date(
                    Date.now() - 60 * 60 * 24 * 7 * 1000
                );

                // Get historical data for pair from start date until now
                // Also fetch last 7 days hourly
                // and get last 24h from last 7 days
                const [
                    { data: historicalDailyData, error: dailyDataError },
                    { data: historicalHourlyData, error: hourlyDataError },
                ] = await Promise.all([
                    Uniswap.getHistoricalDailyData(pairId, pairCreatedAt),
                    Uniswap.getHistoricalHourlyData(pairId, oneWeekAgo),
                ]);

                (window as any).hourlyData = historicalHourlyData;

                const historicalErrors = dailyDataError ?? hourlyDataError;
                if (historicalErrors) {
                    // we could not get data for this new pair
                    console.warn(
                        `Could not fetch historical data for ${pairId}: ${historicalErrors}`
                    );
                    setError(historicalErrors);
                    return;
                }

                if (historicalDailyData && historicalHourlyData) {
                    setLPInfo(
                        (prevLpInfo): PairPricesState => ({
                            ...prevLpInfo,
                            pairData: newPair,
                            historicalDailyData,
                            historicalHourlyData,
                        })
                    );
                } else {
                    throw new Error(
                        `Error populating historical info - did not receive error or data`
                    );
                }

                mixpanel.track('pair:query', {
                    pairId,
                    token0: newPair.token0.symbol,
                    token1: newPair.token1.symbol,
                });

                setIsLoading(false);
            }
        };

        void fetchPairData();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pairId]);

    useEffect(() => {
        if (!pairId || currentError) return;

        const getLatestSwaps = async () => {
            // Fetch latest block when pair ID changes
            // Default to createdAt date if LP date not set
            const [
                { data: latestSwaps, error: swapsErrors },
                { data: mintsAndBurns, error: mintBurnErrors },
            ] = await Promise.all([
                Uniswap.getLatestSwaps(pairId),
                Uniswap.getMintsAndBurns(pairId),
            ]);

            const error = swapsErrors ?? mintBurnErrors;

            if (error) {
                // we could not get data for this new pair
                console.warn(
                    `Could not fetch trades data for ${pairId}: ${error}`
                );
                setError(error);
                return;
            }

            if (latestSwaps && mintsAndBurns) {
                setLatestSwaps({ swaps: latestSwaps, mintsAndBurns });
            }
        };

        const refreshPairData = async () => {
            if (!pairId) return;

            const { data: newPairData } = await Uniswap.getPairOverview(pairId);

            setLPInfo(
                (prevLpInfo) =>
                    ({
                        ...prevLpInfo,
                        pairData: newPairData,
                    } as PairPricesState)
            );
        };

        void getLatestSwaps();
        void refreshPairData();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pairId]);

    if (!pairId || isLoading) {
        return { isLoading: true };
    } else if (!isLoading && currentError) {
        return { isLoading, currentError };
    } else if (!isLoading && lpInfo) {
        return {
            isLoading,
            lpInfo,
            latestSwaps,
        };
    } else {
        throw new Error(
            `Error in usePairData - not loading but no error or data present`
        );
    }
}
