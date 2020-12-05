import BN from 'bn.js';

const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  
    // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});

function USDValueWidget({ title, value }) {
    const displayValue = formatter.format(parseInt(value, 10));    

    return (
        <>
            <h3>{title}</h3>
            <p>{displayValue}</p>
        </>
    );
}

export default USDValueWidget;