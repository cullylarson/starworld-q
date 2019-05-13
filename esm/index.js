import {compose, curry, ifElse, identity, reduce, map, filter, liftA, set, get} from '@cullylarson/f'

const append = curry((toAppend, xs) => xs.concat(toAppend))

const flatten = reduce((acc, x) => acc.concat(Array.isArray(x) ? flatten(x) : x), [])

const appendFlat = curry((toAppend, x) => {
    return [
        ...x,
        ...toAppend,
    ]
})

const shallowFlatten = reduce((acc, x) => (Array.isArray(x) ? [...acc, ...x] : [...acc, x]), [])

const liftAofA = xs => {
    return xs && xs.length && Array.isArray(xs[0])
        ? xs
        : xs
            ? [xs]
            : []
}

// append array:toAppend to object:x at key
const appendAt = (key, toAppend, x) => {
    return x.hasOwnProperty(key)
        ? {
            ...x,
            [key]: [
                ...x[key],
                ...toAppend,
            ],
        }
        : {
            ...x,
            [key]: toAppend,
        }
}

const select = curry((xs, q) => {
    xs = liftA(xs)

    return appendAt('select', xs, q)
})

const from = curry((xs, q) => {
    xs = liftA(xs)

    return appendAt('from', xs, q)
})

const condsLift = xs => {
    return Array.isArray(xs)
        ? liftAofA(xs)
        : typeof xs === 'string'
            ? [[xs]]
            : [xs]
}

const where = curry((xs, q) => {
    xs = condsLift(xs)

    return appendAt('where', xs, q)
})

const groupBy = curry((xs, q) => {
    xs = liftA(xs)

    return appendAt('groupBy', xs, q)
})

const order = curry((xs, q) => {
    xs = liftA(xs)

    return appendAt('order', xs, q)
})

const limit = curry((x, q) => {
    return set('limit', x, q)
})

const offset = curry((x, q) => {
    return set('offset', x, q)
})

const leftJoin = curry((tableName, ons, q) => {
    return appendAt('leftJoin', [[tableName, liftA(ons)]], q)
})

const combineConditions = (kind, conds) => {
    return {
        kind,
        conds: condsLift(conds.map(x => typeof x === 'string' ? [x] : x)),
    }
}

const or = (conds) => combineConditions('or', conds)
const and = (conds) => combineConditions('and', conds)

const qToString = q => {
    const selectStr = q => q.select && q.select.length ? 'SELECT ' + q.select.join(', ') : ''
    const fromStr = q => q.from && q.from.length ? 'FROM ' + q.from.join(', ') : ''
    const orderStr = q => q.order && q.order.length ? 'ORDER BY ' + q.order.join(', ') : ''
    const limitStr = q => q.hasOwnProperty('limit') ? 'LIMIT ?' : ''
    const offsetStr = q => q.hasOwnProperty('offset') ? 'OFFSET ?' : ''
    const groupByStr = q => q.groupBy && q.groupBy.length ? 'GROUP BY ' + q.groupBy.join(', ') : ''

    const whereStr = q => {
        if(!q.where || !q.where.length) return ''

        const combineConds = (x) => {
            const joinStr = x.kind === 'or'
                ? ' OR '
                : ' AND '

            return '(' + x.conds.map(x => wherePieces([x])).join(joinStr) + ')'
        }

        const wherePieces = xs => xs.map(x => {
            return Array.isArray(x)
                ? x.length === 1
                    ? x[0]
                    : `${x[0]} ${x[1]} ?`
                : combineConds(x)
        })

        return 'WHERE ' + wherePieces(q.where).join(' AND ')
    }

    const leftJoinStr = q => {
        if(!q.leftJoin || !q.leftJoin.length) return ''

        const joinPieces = q.leftJoin.map(x => {
            const onPieces = liftA(get(1, [], x))
                .map(x => {
                    return Array.isArray(x)
                        ? `${x[0]} ${x[1]} ?`
                        : x
                })
                .join(' AND ')

            return `LEFT JOIN ${x[0]} ON (${onPieces})`
        })

        return joinPieces.join(' ')
    }

    return [
        selectStr(q),
        fromStr(q),
        leftJoinStr(q),
        whereStr(q),
        groupByStr(q),
        orderStr(q),
        limitStr(q),
        offsetStr(q),
    ].filter(x => !!x).join(' ')
}

const qToPlaceholders = q => {
    const getWherePlaceholders = xs => flatten(xs
        .filter(x => x.conds || x.length > 2)
        .map(x => {
            return Array.isArray(x)
                ? x[2]
                : shallowFlatten(getWherePlaceholders(x.conds))
        }))

    const wherePlaceholders = q.where && q.where.length ? getWherePlaceholders(q.where) : []

    const leftJoinPlaceholders = q.leftJoin && q.leftJoin.length
        ? compose(
            map(x => x[2]),
            filter(x => Array.isArray(x) && x.length > 2),
            shallowFlatten,
            map(get(1, []))
        )(q.leftJoin)
        : []

    return compose(
        ifElse(
            () => q.hasOwnProperty('offset'),
            append(q.offset),
            identity
        ),
        ifElse(
            () => q.hasOwnProperty('limit'),
            append(q.limit),
            identity
        ),
        ifElse(
            () => wherePlaceholders.length > 0,
            appendFlat(wherePlaceholders),
            identity
        ),
        ifElse(
            () => leftJoinPlaceholders.length > 0,
            appendFlat(leftJoinPlaceholders),
            identity
        )
    )([])
}

module.exports = {
    select,
    from,
    leftJoin,
    where,
    groupBy,
    order,
    limit,
    offset,
    qToString,
    qToPlaceholders,
    and,
    or,
}
