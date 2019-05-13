import {curry, liftA, set} from '@cullylarson/f'

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

export default {
    select,
    from,
    leftJoin,
    where,
    groupBy,
    order,
    limit,
    offset,
    and,
    or,
}
