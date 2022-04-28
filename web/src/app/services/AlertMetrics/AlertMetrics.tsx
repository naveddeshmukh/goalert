import React, { useMemo } from 'react'
import { Box, Card, CardContent, CardHeader, Grid } from '@mui/material'
import { useQuery, gql } from '@apollo/client'
import { DateTime, Duration } from 'luxon'
import { useParams } from 'react-router-dom'
import { useURLParams } from '../../actions/hooks'
import AlertMetricsFilter, {
  DATE_FORMAT,
  MAX_DAY_COUNT,
} from './AlertMetricsFilter'
import AlertCountGraph from './AlertCountGraph'
import AlertMetricsTable from './AlertMetricsTable'
import AlertAveragesGraph from './AlertAveragesGraph'
import Notices from '../../details/Notices'
import { GenericError, ObjectNotFound } from '../../error-pages'
import { AlertDataPoint } from '../../../schema'

const query = gql`
  query alertmetrics(
    $serviceID: ID!
    $alertSearchInput: AlertSearchOptions!
    $alertMetricsInput: AlertMetricsOptions!
  ) {
    service(id: $serviceID) {
      id
    }
    alerts(input: $alertSearchInput) {
      nodes {
        id
        alertID
        summary
        details
        status
        service {
          name
          id
        }
        createdAt
      }
      pageInfo {
        hasNextPage
      }
    }
    alertMetrics(input: $alertMetricsInput) {
      alertCount
      timestamp
      avgTimeToAck
      avgTimeToClose
    }
  }
`

const QUERY_LIMIT = 100

export default function AlertMetrics(): JSX.Element {
  const { serviceID } = useParams<{ serviceID: string }>()
  const now = useMemo(() => DateTime.now(), [])
  const minDate = now.minus({ days: MAX_DAY_COUNT - 1 }).startOf('day')
  const maxDate = now.endOf('day')

  const [params] = useURLParams({
    since: minDate.toFormat(DATE_FORMAT),
    until: maxDate.toFormat(DATE_FORMAT),
  })

  const since = DateTime.fromFormat(params.since, DATE_FORMAT).startOf('day')
  const until = DateTime.fromFormat(params.until, DATE_FORMAT).endOf('day')

  const isValidRange =
    since >= minDate &&
    until >= minDate &&
    since <= maxDate &&
    until <= maxDate &&
    since <= until

  const q = useQuery(query, {
    variables: {
      serviceID,
      alertSearchInput: {
        filterByServiceID: [serviceID],
        first: QUERY_LIMIT,
        notCreatedBefore: since.toISO(),
        createdBefore: until.toISO(),
        filterByStatus: ['StatusClosed'],
      },
      alertMetricsInput: {
        rInterval: `R${Math.floor(
          until.diff(since, 'days').days,
        )}/${since.toISO()}/P1D`,
        filterByServiceID: [serviceID],
      },
    },
    skip: !isValidRange,
  })

  if (!isValidRange) {
    return <GenericError error='The requested date range is out-of-bounds' />
  }

  if (q.error) {
    return <GenericError error={q.error.message} />
  }
  if (!q.loading && !q.data?.service?.id) {
    return <ObjectNotFound type='service' />
  }

  const hasNextPage = q.data?.alerts?.pageInfo?.hasNextPage ?? false
  const alerts = q.data?.alerts?.nodes ?? []
  const alertMetrics = q.data?.alertMetrics ?? []

  const data = alertMetrics.map((day: AlertDataPoint) => {
    const formatDuration = (dur: Duration): string => {
      if (!dur.isValid) return '0'
      const durStr = dur.toHuman({ unitDisplay: 'short' })
      // strip milliseconds from duration string
      return durStr.substring(0, durStr.lastIndexOf(','))
    }
    const ackDuration = Duration.fromISO(day.avgTimeToAck || '')
    const closeDuration = Duration.fromISO(day.avgTimeToClose || '')

    const ackAvgMinutes = ackDuration.shiftTo('minutes').minutes
    const closeAvgMinutes = closeDuration.shiftTo('minutes').minutes

    const timestamp = DateTime.fromISO(day.timestamp)
    const date = timestamp.toLocaleString({
      month: 'short',
      day: 'numeric',
    })
    const label = timestamp.toLocaleString({
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return {
      date: date,
      label: label,
      count: day.alertCount,
      avgTimeToAck: ackDuration.isValid ? ackAvgMinutes : 0,
      avgTimeToClose: closeDuration.isValid ? closeAvgMinutes : 0,
      formattedAckLabel: formatDuration(ackDuration),
      formattedCloseLabel: formatDuration(closeDuration),
    }
  })

  const daycount = Math.floor(now.diff(since, 'days').plus({ day: 1 }).days)

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        {hasNextPage && (
          <Box sx={{ marginBottom: '1rem' }}>
            <Notices
              notices={[
                {
                  type: 'WARNING',
                  message: 'Query limit reached',
                  details: `More than ${QUERY_LIMIT} alerts were found, but only the first ${QUERY_LIMIT} are represented below.`,
                },
              ]}
            />
          </Box>
        )}
        <Card>
          <CardHeader
            component='h2'
            title={`Daily alert metrics over the past ${daycount} days`}
          />
          <CardContent>
            <AlertMetricsFilter now={now} />
            <AlertCountGraph data={data} />
            <AlertAveragesGraph data={data} />
            <AlertMetricsTable
              alerts={alerts}
              loading={q.loading || !q?.data?.alerts}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
