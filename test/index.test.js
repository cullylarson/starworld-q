import {compose} from '@cullylarson/f'
import Q from '../esm/'

test('Builds a simple select from query', () => {
    const q = compose(
        Q.from('test'),
        Q.select('*')
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * FROM test')
    expect(Q.qToPlaceholders(q)).toEqual([])
})

test('Builds a simple select from where query', () => {
    const q = compose(
        Q.where('a = b'),
        Q.from('test'),
        Q.select('*')
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * FROM test WHERE a = b')
    expect(Q.qToPlaceholders(q)).toEqual([])
})

test('Builds a complex select from where query', () => {
    const q = compose(
        Q.where(['a', '=', 'asdf']),
        Q.from(['test t', 'blah b']),
        Q.select(['* as a', 'test.blah as b'])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * as a, test.blah as b FROM test t, blah b WHERE a = ?')
    expect(Q.qToPlaceholders(q)).toEqual(['asdf'])
})

test('Builds a simple select from leftJoin where query', () => {
    const q = compose(
        Q.where(['a', '=', 'asdf']),
        Q.leftJoin('something s', 's.id = b.id'),
        Q.from(['test t', 'blah b']),
        Q.select(['* as a', 'test.blah as b'])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * as a, test.blah as b FROM test t, blah b LEFT JOIN something s ON (s.id = b.id) WHERE a = ?')
    expect(Q.qToPlaceholders(q)).toEqual(['asdf'])
})

test('Builds a complex select from leftJoin where query', () => {
    const q = compose(
        Q.where(['blue', '!=', 'red']),
        Q.where(['a', '=', 'asdf']),
        Q.leftJoin('foo f', [['f.id', '!=', '1'], ['f.key', '=', 'Foo']]),
        Q.leftJoin('something s', ['s.id = b.id', ['s.name', '=', 'Cully']]),
        Q.from(['test t', 'blah b']),
        Q.select(['* as a', 'test.blah as b'])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * as a, test.blah as b FROM test t, blah b LEFT JOIN something s ON (s.id = b.id AND s.name = ?) LEFT JOIN foo f ON (f.id != ? AND f.key = ?) WHERE a = ? AND blue != ?')
    expect(Q.qToPlaceholders(q)).toEqual(['Cully', '1', 'Foo', 'asdf', 'red'])
})

test('Builds a complex select from where query order limit offset', () => {
    const q = compose(
        Q.offset(100),
        Q.limit(3),
        Q.order(['blue ASC', 'red DESC']),
        Q.where(['a', '=', 'asdf']),
        Q.from(['test t', 'blah b']),
        Q.select(['* as a', 'test.blah as b'])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * as a, test.blah as b FROM test t, blah b WHERE a = ? ORDER BY blue ASC, red DESC LIMIT ? OFFSET ?')
    expect(Q.qToPlaceholders(q)).toEqual(['asdf', 3, 100])
})

test('Builds another complex select from where query order limit offset', () => {
    const q = compose(
        Q.offset(100),
        Q.limit(3),
        Q.order('red DESC'),
        Q.order('blue ASC'),
        Q.where('a = b'),
        Q.where(['some', 'LIKE', 'thing']),
        Q.where(['a', '=', 'asdf']),
        Q.from('blah b'),
        Q.from('test t'),
        Q.select('test.blah as b'),
        Q.select('* as a')
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * as a, test.blah as b FROM test t, blah b WHERE a = ? AND some LIKE ? AND a = b ORDER BY blue ASC, red DESC LIMIT ? OFFSET ?')
    expect(Q.qToPlaceholders(q)).toEqual(['asdf', 'thing', 3, 100])
})

test('Builds a complex select from where query groupby order limit offset', () => {
    const q = compose(
        Q.offset(100),
        Q.limit(3),
        Q.order(['blue ASC', 'red DESC']),
        Q.groupBy(['c', 'd']),
        Q.groupBy('b'),
        Q.groupBy('a'),
        Q.where(['a', '=', 'asdf']),
        Q.from(['test t', 'blah b']),
        Q.select(['SUM(a)', 'test.blah as b'])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT SUM(a), test.blah as b FROM test t, blah b WHERE a = ? GROUP BY a, b, c, d ORDER BY blue ASC, red DESC LIMIT ? OFFSET ?')
    expect(Q.qToPlaceholders(q)).toEqual(['asdf', 3, 100])
})

test('Combines conditions simple', () => {
    const q = compose(
        Q.where(Q.or([['c', '=', 'CCC'], ['d', '=', 'DDD']])),
        Q.where('a = b'),
        Q.from('blah'),
        Q.select('*')
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * FROM blah WHERE a = b AND (c = ? OR d = ?)')
    expect(Q.qToPlaceholders(q)).toEqual(['CCC', 'DDD'])
})

test('Combines conditions complex', () => {
    const q = compose(
        Q.where(Q.or([
            ['c', '=', 'CCC'],
            ['d', '=', 'DDD'],
            Q.and([
                ['e', '=', 'EEE'],
                ['g = 2'],
                Q.or([
                    ['h', '!=', 'HHH'],
                    ['i = 27'],
                    ['j', '=', 'JJJ'],
                ]),
            ]),
        ])),
        Q.where('a = b'),
        Q.from('blah'),
        Q.select('*')
    )({})

    expect(Q.qToString(q)).toEqual('SELECT * FROM blah WHERE a = b AND (c = ? OR d = ? OR (e = ? AND g = 2 AND (h != ? OR i = 27 OR j = ?)))')
    expect(Q.qToPlaceholders(q)).toEqual(['CCC', 'DDD', 'EEE', 'HHH', 'JJJ'])
})

test('Combines conditions complex two', () => {
    const onlyUpdateBeforeDate = '1981-02-08'

    const q = compose(
        Q.select('c.*'),
        Q.from('campaigns c'),
        Q.leftJoin('campaignReports cr', 'cr.campaignId = c.id'),
        Q.where([
            ['c.startDate', '<=', onlyUpdateBeforeDate],
            Q.or([
                ['cr.id IS NULL'],
                ['cr.isFinal = FALSE'],
                ['cr.isCancelledWhenMarkedFinal != c.isCancelled'],
                ['cr.startDateWhenMarkedFinal != c.startDate'],
                ['cr.endDateWhenMarkedFinal != c.endDate'],
                ['cr.created', '<=', onlyUpdateBeforeDate],
            ]),
        ])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT c.* FROM campaigns c LEFT JOIN campaignReports cr ON (cr.campaignId = c.id) WHERE c.startDate <= ? AND (cr.id IS NULL OR cr.isFinal = FALSE OR cr.isCancelledWhenMarkedFinal != c.isCancelled OR cr.startDateWhenMarkedFinal != c.startDate OR cr.endDateWhenMarkedFinal != c.endDate OR cr.created <= ?)')
    expect(Q.qToPlaceholders(q)).toEqual([onlyUpdateBeforeDate, onlyUpdateBeforeDate])
})

test('Combines conditions complex three', () => {
    const onlyUpdateBeforeDate = '1981-02-08'

    const q = compose(
        Q.select('c.*'),
        Q.from('campaigns c'),
        Q.leftJoin('campaignReports cr', 'cr.campaignId = c.id'),
        Q.where([
            ['c.startDate', '<=', onlyUpdateBeforeDate],
            Q.or([
                'cr.id IS NULL',
                'cr.isFinal = FALSE',
                'cr.isCancelledWhenMarkedFinal != c.isCancelled',
                'cr.startDateWhenMarkedFinal != c.startDate',
                'cr.endDateWhenMarkedFinal != c.endDate',
                ['cr.created', '<=', onlyUpdateBeforeDate],
            ]),
        ])
    )({})

    expect(Q.qToString(q)).toEqual('SELECT c.* FROM campaigns c LEFT JOIN campaignReports cr ON (cr.campaignId = c.id) WHERE c.startDate <= ? AND (cr.id IS NULL OR cr.isFinal = FALSE OR cr.isCancelledWhenMarkedFinal != c.isCancelled OR cr.startDateWhenMarkedFinal != c.startDate OR cr.endDateWhenMarkedFinal != c.endDate OR cr.created <= ?)')
    expect(Q.qToPlaceholders(q)).toEqual([onlyUpdateBeforeDate, onlyUpdateBeforeDate])
})

test('Combines conditions with mutiple where', () => {
    const onlyUpdateBeforeDate = '1981-02-08'
    const term = 'blah'

    const q = compose(
        Q.select('c.*'),
        Q.from('campaigns c'),
        Q.leftJoin('campaignReports cr', 'cr.campaignId = c.id'),
        Q.where([
            ['c.startDate', '<=', onlyUpdateBeforeDate],
            Q.or([
                'cr.id IS NULL',
                'cr.isFinal = FALSE',
            ]),
        ]),
        Q.where('a = b'),
        Q.where(
            Q.or([
                ['term', '=', term],
                ['term', '=', '"' + term + '"'],
                ['term', '=', '\'' + term + '\''],
            ])
        )
    )({})

    expect(Q.qToString(q)).toEqual('SELECT c.* FROM campaigns c LEFT JOIN campaignReports cr ON (cr.campaignId = c.id) WHERE (term = ? OR term = ? OR term = ?) AND a = b AND c.startDate <= ? AND (cr.id IS NULL OR cr.isFinal = FALSE)')
    expect(Q.qToPlaceholders(q)).toEqual([term, '"' + term + '"', '\'' + term + '\'', onlyUpdateBeforeDate])
})
